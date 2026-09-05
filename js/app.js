/* «Чудный сад» — витрина каталога. Данные: data/catalog.js (window.CATALOG). */
(function () {
  "use strict";

  var shop = window.CATALOG.shop;
  var categories = window.CATALOG.categories;

  /* Предпросмотр большого ассортимента: каждая позиция показывается
     DEMO_COPIES раз. Перед публикацией на GitHub Pages поставить 1. */
  var DEMO_COPIES = 1;

  var products = [];
  for (var copy = 0; copy < DEMO_COPIES; copy++) {
    window.CATALOG.products.forEach(function (p) {
      var clone = JSON.parse(JSON.stringify(p));
      clone.uid = p.id + "#" + copy;
      products.push(clone);
    });
  }

  var fmtRub = function (kop) { return Math.round(kop / 100).toLocaleString("ru-RU") + " ₽"; };

  /* ================= Тема: светлая / тёмная (графит) =================
     Стартовый класс ставит инлайн-скрипт в <head> (без вспышки).
     Здесь — переключение: в браузерах с View Transitions тема
     раскрывается кругом из точки нажатия (как в Telegram),
     в остальных и при prefers-reduced-motion — мгновенно. */
  var THEME_KEY = "chudniSadTheme";
  var themeBtn = document.getElementById("theme-toggle");

  function isDark() { return document.documentElement.classList.contains("theme-dark"); }

  function applyThemeMeta() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark() ? "#1e2124" : "#e7f0d9");
    if (themeBtn) themeBtn.setAttribute("aria-label", isDark() ? "Включить светлую тему" : "Включить тёмную тему");
  }

  function setTheme(dark, x, y) {
    var root = document.documentElement;
    var apply = function () {
      root.classList.toggle("theme-dark", dark);
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
      applyThemeMeta();
    };
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) { apply(); return; }
    var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
    root.style.setProperty("--tx", x + "px");
    root.style.setProperty("--ty", y + "px");
    root.style.setProperty("--tr", r + "px");
    document.startViewTransition(apply);
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", function (e) {
      var rect = themeBtn.getBoundingClientRect();
      var x = e.clientX || rect.left + rect.width / 2;
      var y = e.clientY || rect.top + rect.height / 2;
      setTheme(!isDark(), x, y);
    });
  }
  applyThemeMeta();

  var fmtPrice = function (product) {
    if (product.priceMin === product.priceMax) return fmtRub(product.priceMin);
    return fmtRub(product.priceMin) + " – " + fmtRub(product.priceMax);
  };

  var stockInfo = function (product) {
    if (product.stockCount === 0) {
      return { text: "Продано", cls: "card__stock card__stock--out", disabled: true };
    }
    if (product.stockCount === 1) {
      return { text: "Остался 1 шт", cls: "card__stock card__stock--low" };
    }
    if (product.stockCount) {
      return { text: "В наличии · " + product.stockCount + " шт", cls: "card__stock" };
    }
    return { text: "В наличии", cls: "card__stock" };
  };

  var badgeClass = function (type) {
    if (type === "sale") return "card__promo card__promo--sale";
    if (type === "soon") return "card__promo card__promo--soon";
    return "card__promo card__promo--promo";
  };

  var volumeLabel = function (product) {
    if (!product || !product.volume) return "саженец";
    var liters = (product.volume % 1 === 0) ? product.volume : product.volume.toFixed(1).replace(".", ",");
    return "контейнер " + liters + " л";
  };

  /* Иконка корзины для круглой кнопки в компактной карточке */
  var CART_ICON_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 3.5h2l2.5 11h9.7a1.6 1.6 0 0 0 1.56-1.22L20.6 7H6.2"/></svg>';

  /* ================= Корзина (localStorage) ================= */

  var CART_KEY = "chudniSadCart";
  var cart = {};

  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  } catch (e) { cart = {}; }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    updateCartBadge();
    refreshAllAddButtons();
  }

  function cartEntries() {
    return Object.keys(cart)
      .map(function (uid) { return cart[uid]; })
      .sort(function (a, b) { return a.addedAt - b.addedAt; });
  }

  function cartTotalCount() {
    return cartEntries().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function cartTotalSum() {
    return cartEntries().reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  function addToCart(product) {
    var existing = cart[product.uid];
    if (existing) {
      existing.qty += 1;
    } else {
      cart[product.uid] = {
        uid: product.uid,
        name: product.name,
        price: product.priceMin,
        priceLabel: fmtPrice(product),
        range: product.priceMin !== product.priceMax,  /* серая строка-диапазон не нужна при одной цене */
        photo: product.photos[0].file,
        qty: 1,
        addedAt: Date.now()
      };
    }
    saveCart();
  }

  function updateCartBadge() {
    var n = cartTotalCount();
    var badge = document.getElementById("cart-count");
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? "99+" : String(n);
  }

  /* ================= Категории: вкладки (ПК) и фильтр-шторка (телефон) =================
     activeCats: [] = «Все»; одна категория — как вкладка; несколько —
     мультивыбор чекбоксами в стеклянной шторке фильтра. */
  var activeCats = [];
  var tabsRoot = document.getElementById("tabs");

  function applyCategoryFilter() {
    renderTabs();
    renderCards();
    renderFilterPanel();
    updateFilterBadge();
  }

  function renderTabs() {
    tabsRoot.innerHTML = "";
    var present = {};
    products.forEach(function (p) { present[p.category] = (present[p.category] || 0) + 1; });

    var list = ["Все"].concat(categories.filter(function (c) { return present[c]; }));
    list.forEach(function (name) {
      var btn = document.createElement("button");
      btn.type = "button";
      var on = name === "Все" ? activeCats.length !== 1 : (activeCats.length === 1 && activeCats[0] === name);
      btn.className = "tab" + (on ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", on ? "true" : "false");
      var label = document.createElement("span");
      label.textContent = name;
      btn.appendChild(label);
      var count = document.createElement("span");
      count.className = "tab__count";
      count.textContent = name === "Все" ? products.length : present[name];
      btn.appendChild(count);
      btn.addEventListener("click", function () {
        activeCats = name === "Все" ? [] : [name];
        applyCategoryFilter();
      });
      tabsRoot.appendChild(btn);
    });
  }

  /* ================= Карточки каталога ================= */

  var cardsRoot = document.getElementById("cards");

  /* ================= Вид каталога: крупные карточки / 2 колонки =================
     Компактный вид (по умолчанию на телефоне) — как в маркетплейсах:
     узкие карточки, цена + круглая кнопка. Выбор запоминается. */
  var VIEW_KEY = "chudniSadCards";
  var viewMode = "compact";
  try {
    var savedView = localStorage.getItem(VIEW_KEY);
    if (savedView === "comfort" || savedView === "compact") viewMode = savedView;
  } catch (e) {}
  var viewSwitch = document.getElementById("view-switch");

  function applyViewMode() {
    cardsRoot.classList.toggle("cards--compact", viewMode === "compact");
    if (viewSwitch) {
      viewSwitch.querySelectorAll("button[data-view]").forEach(function (b) {
        var on = b.getAttribute("data-view") === viewMode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
  }

  if (viewSwitch) {
    viewSwitch.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]");
      if (!b || b.getAttribute("data-view") === viewMode) return;
      viewMode = b.getAttribute("data-view");
      try { localStorage.setItem(VIEW_KEY, viewMode); } catch (err) {}
      applyViewMode();
    });
  }
  applyViewMode();

  /* ================= Фильтр по категориям: стеклянная шторка (телефон) ================= */
  var filterSheet = document.getElementById("filter-sheet");
  var filterList = document.getElementById("filter-list");
  var filterBtn = document.getElementById("filter-btn");
  var filterCount = document.getElementById("filter-count");
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7"/></svg>';

  function renderFilterPanel() {
    if (!filterList) return;
    var counts = {};
    products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var rows = [{ name: "Все растения", count: products.length, on: activeCats.length === 0 }];
    categories.forEach(function (c) {
      if (counts[c]) rows.push({ name: c, count: counts[c], on: activeCats.indexOf(c) !== -1 });
    });
    filterList.innerHTML = "";
    rows.forEach(function (r) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-row" + (r.on ? " is-on" : "");
      btn.innerHTML = '<span class="filter-row__name"></span><span class="filter-row__count"></span>' +
        '<span class="filter-row__check">' + CHECK_SVG + '</span>';
      btn.querySelector(".filter-row__name").textContent = r.name;
      btn.querySelector(".filter-row__count").textContent = r.count;
      btn.addEventListener("click", function () {
        if (r.name === "Все растения") {
          activeCats = [];
        } else {
          var i = activeCats.indexOf(r.name);
          if (i === -1) activeCats.push(r.name); else activeCats.splice(i, 1);
        }
        renderCards();
        renderTabs();
        renderFilterPanel();
        updateFilterBadge();
      });
      filterList.appendChild(btn);
    });
  }

  function updateFilterBadge() {
    if (!filterCount) return;
    filterCount.hidden = activeCats.length === 0;
    filterCount.textContent = activeCats.length;
  }

  function openFilter() {
    renderFilterPanel();
    filterSheet.hidden = false;
    /* два кадра — чтобы стартовал transition, а не «мгновенно показалось» */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { filterSheet.classList.add("show"); });
    });
  }

  function closeFilter() {
    filterSheet.classList.remove("show");
    setTimeout(function () { filterSheet.hidden = true; }, 380);
  }

  if (filterBtn) filterBtn.addEventListener("click", openFilter);
  if (filterSheet) {
    filterSheet.addEventListener("click", function (e) {
      if (e.target.closest("[data-filter-close]")) closeFilter();
    });
    document.getElementById("filter-done").addEventListener("click", closeFilter);
  }

  function renderCards() {
    cardsRoot.innerHTML = "";
    var visible = products.filter(function (p) {
      return activeCats.length === 0 || activeCats.indexOf(p.category) !== -1;
    });

    visible.forEach(function (product, index) {
      var stock = stockInfo(product);
      var main = product.photos[0];

      var card = document.createElement("article");
      card.className = "card";
      /* каскад появления: первые карточки сразу, дальше с задержкой */
      card.style.animationDelay = (Math.min(index, 10) * 45) + "ms";

      var photoBtn = document.createElement("button");
      photoBtn.type = "button";
      photoBtn.className = "card__photo-btn";
      photoBtn.setAttribute("aria-label", "Подробнее о: " + product.name);

      var photoWrap = document.createElement("div");
      photoWrap.className = "card__photo-wrap";

      /* Мини-карусель: свайп листает фото, тап открывает карточку товара */
      var slider = document.createElement("div");
      slider.className = "card__slider";
      var track = document.createElement("div");
      track.className = "card__track";

      product.photos.forEach(function (photo) {
        var img = document.createElement("img");
        img.src = "assets/img/" + photo.file;
        img.alt = photo.alt;
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        var showPhoto = function () { img.classList.add("is-loaded"); };
        if (img.complete && img.naturalWidth > 0) showPhoto();
        else img.addEventListener("load", showPhoto);
        track.appendChild(img);
      });
      slider.appendChild(track);

      var slideIdx = 0;
      var slideCount = product.photos.length;
      var suppressClick = false;

      function goToSlide(i) {
        slideIdx = Math.max(0, Math.min(slideCount - 1, i));
        track.style.transition = "";
        track.style.transform = "translateX(-" + (slideIdx * 100) + "%)";
        slider.querySelectorAll(".card__dot").forEach(function (d, di) {
          d.classList.toggle("is-active", di === slideIdx);
        });
      }

      if (slideCount > 1) {
        var dotsRow = document.createElement("div");
        dotsRow.className = "card__dots";
        for (var di = 0; di < slideCount; di++) {
          var dot = document.createElement("span");
          dot.className = "card__dot" + (di === 0 ? " is-active" : "");
          dotsRow.appendChild(dot);
        }
        slider.appendChild(dotsRow);
      }

      /* Свайп (touch) и перетаскивание (мышь) по фото карточки */
      var pxStart = null, pyStart = null, swiping = false, draggedFar = false;
      var wrapWidth = function () { return photoWrap.clientWidth || 1; };

      function trackFollow(dx) {
        track.style.transition = "none";
        var atEdge = (slideIdx === 0 && dx > 0) || (slideIdx === slideCount - 1 && dx < 0);
        track.style.transform = "translateX(calc(-" + (slideIdx * 100) + "% + " + (atEdge ? dx * 0.35 : dx) + "px))";
      }

      photoBtn.addEventListener("touchstart", function (e) {
        pxStart = e.touches[0].clientX;
        pyStart = e.touches[0].clientY;
        swiping = false;
        draggedFar = false;
      }, { passive: true });

      photoBtn.addEventListener("touchmove", function (e) {
        if (pxStart === null || slideCount < 2) return;
        var dx = e.touches[0].clientX - pxStart;
        var dy = e.touches[0].clientY - pyStart;
        if (!swiping) {
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) swiping = true;
          else return;
        }
        if (Math.abs(dx) > 40) draggedFar = true;
        trackFollow(dx);
      }, { passive: true });

      photoBtn.addEventListener("touchend", function (e) {
        if (pxStart === null) return;
        var dx = e.changedTouches[0].clientX - pxStart;
        if (swiping && slideCount > 1) {
          if (dx < -40 && slideIdx < slideCount - 1) goToSlide(slideIdx + 1);
          else if (dx > 40 && slideIdx > 0) goToSlide(slideIdx - 1);
          else goToSlide(slideIdx);
        }
        pxStart = null;
        swiping = false;
        if (draggedFar) {
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 80);
        }
      });

      photoBtn.addEventListener("mousedown", function (e) {
        if (slideCount < 2) return;
        pxStart = e.clientX;
        pyStart = e.clientY;
        draggedFar = false;
        e.preventDefault();
      });
      window.addEventListener("mousemove", function (e) {
        if (pxStart === null) return;
        var dx = e.clientX - pxStart;
        if (Math.abs(dx) > 5) {
          draggedFar = true;
          trackFollow(dx);
        }
      });
      window.addEventListener("mouseup", function (e) {
        if (pxStart === null) return;
        var dx = e.clientX - pxStart;
        pxStart = null;
        if (draggedFar && slideCount > 1) {
          if (dx < -40 && slideIdx < slideCount - 1) goToSlide(slideIdx + 1);
          else if (dx > 40 && slideIdx > 0) goToSlide(slideIdx - 1);
          else goToSlide(slideIdx);
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 80);
        }
      });

      var badges = document.createElement("div");
      badges.className = "card__badges";
      (product.badges || []).forEach(function (b) {
        var promo = document.createElement("span");
        promo.className = badgeClass(b.type);
        promo.textContent = b.label;
        badges.appendChild(promo);
      });

      var stockEl = document.createElement("span");
      stockEl.className = stock.cls;
      stockEl.textContent = stock.text;

      var tag = document.createElement("span");
      tag.className = "tag card__tag";
      tag.setAttribute("aria-hidden", "true");
      tag.innerHTML = '<span class="tag__latin"></span><span class="tag__hand"></span>';
      tag.querySelector(".tag__latin").textContent = product.latin;
      tag.querySelector(".tag__hand").textContent = product.age
        ? product.age + " · " + volumeLabel(product)
        : volumeLabel(product);

      photoWrap.appendChild(slider);
      photoWrap.appendChild(badges);
      photoWrap.appendChild(stockEl);
      photoWrap.appendChild(tag);
      photoBtn.appendChild(photoWrap);
      photoBtn.addEventListener("click", function () {
        if (suppressClick) return;   /* это был свайп, а не тап */
        openModal(product);
      });
      card.appendChild(photoBtn);

      var body = document.createElement("div");
      body.className = "card__body";

      var name = document.createElement("h3");
      name.className = "card__name";
      name.textContent = product.name;

      var short = document.createElement("p");
      short.className = "card__short";
      short.textContent = product.short;

      var row = document.createElement("div");
      row.className = "card__row";

      var price = document.createElement("p");
      price.className = "card__price";
      price.innerHTML = "<span></span><small></small>";
      price.querySelector("span").textContent = fmtPrice(product);
      price.querySelector("small").textContent = volumeLabel(product);

      var actions = document.createElement("div");
      actions.className = "card__actions";

      var add = document.createElement("button");
      add.className = "btn btn--primary card__add";
      add.type = "button";
      add.setAttribute("data-uid", product.uid);
      /* В компактной карточке (2 колонки) текст прячется — остаётся
         иконка корзины с бейджем количества; в обычном виде наоборот. */
      add.innerHTML = CART_ICON_SVG + '<span class="card__add-txt"></span><span class="add-badge" aria-hidden="true"></span>';
      if (stock.disabled) {
        add.disabled = true;
        add.querySelector(".card__add-txt").textContent = "Продано";
        add.style.opacity = ".55";
        add.style.cursor = "default";
      } else {
        add.querySelector(".card__add-txt").textContent = "В корзину";
        add.setAttribute("aria-label", "В корзину: " + product.name);
        add.addEventListener("click", function (event) {
          addToCart(product);
          flyToCart(event, product);
          refreshAddButton(add, product);
          add.classList.add("is-added");
          setTimeout(function () { add.classList.remove("is-added"); }, 900);
        });
      }

      actions.appendChild(add);
      row.appendChild(price);
      row.appendChild(actions);
      body.appendChild(name);
      body.appendChild(short);
      body.appendChild(row);
      card.appendChild(body);

      /* В широком виде (1 колонка) карточка открывается целиком: клик по
         любому месту, кроме кнопки «В корзину». В компактном (2 колонки)
         остаётся только фото — там тело маленькое и кнопка занимает четверть. */
      card.addEventListener("click", function (event) {
        if (viewMode !== "comfort") return;
        if (event.target.closest("button")) return;
        openModal(product);
      });

      cardsRoot.appendChild(card);
    });
  }

  /* ================= Модальное окно товара ================= */

  var modal = document.getElementById("modal");
  var cartModal = document.getElementById("cart");
  var modalTrack = document.getElementById("modal-track");
  var modalDots = document.getElementById("modal-dots");
  var modalSlider = document.getElementById("modal-slider");
  var modalThumbs = document.getElementById("modal-thumbs");
  var modalLatin = document.getElementById("modal-latin");
  var modalTitle = document.getElementById("modal-title");
  var modalPrice = document.getElementById("modal-price");
  var modalDesc = document.getElementById("modal-desc");
  var modalTraits = document.getElementById("modal-traits");
  var modalAdd = document.getElementById("modal-add");
  var lastFocused = null;
  var currentSlide = 0;
  var slideCount = 0;
  var shareProduct = null;
  var modalProduct = null;
  var shareTxt = document.querySelector(".modal__share-txt");

  function renderSlider(product) {
    modalTrack.innerHTML = "";
    modalDots.innerHTML = "";
    modalThumbs.innerHTML = "";
    currentSlide = 0;
    slideCount = product.photos.length;

    product.photos.forEach(function (photo, index) {
      var img = document.createElement("img");
      img.src = "assets/img/" + photo.file;
      img.alt = photo.alt;
      img.draggable = false;
      modalTrack.appendChild(img);

      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "modal__dot" + (index === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Фото " + (index + 1) + " из " + product.photos.length);
      dot.addEventListener("click", function () { goToSlide(index); });
      modalDots.appendChild(dot);

      var thumb = document.createElement("button");
      thumb.type = "button";
      if (index === 0) thumb.classList.add("is-active");
      var thumbImg = document.createElement("img");
      thumbImg.src = "assets/img/" + photo.file;
      thumbImg.alt = "";
      thumb.appendChild(thumbImg);
      thumb.addEventListener("click", function () { goToSlide(index); });
      modalThumbs.appendChild(thumb);
    });

    modalTrack.style.transform = "translateX(0)";
  }

  function goToSlide(index) {
    currentSlide = Math.max(0, Math.min(slideCount - 1, index));
    modalTrack.style.transform = "translateX(-" + (currentSlide * 100) + "%)";
    modalDots.querySelectorAll(".modal__dot").forEach(function (d, i) {
      d.classList.toggle("is-active", i === currentSlide);
    });
    modalThumbs.querySelectorAll("button").forEach(function (b, i) {
      b.classList.toggle("is-active", i === currentSlide);
    });
  }

  /* Свайп и перетаскивание фото в галерее */
  (function () {
    var startX = null, startY = null, dragging = false;
    var width = function () { return modalSlider.clientWidth || 1; };

    modalSlider.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
      modalTrack.style.transition = "none";
    }, { passive: true });

    modalSlider.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) {
        var offset = -currentSlide * width() + dx;
        modalTrack.style.transform = "translateX(" + offset + "px)";
      }
    }, { passive: true });

    function finish(e) {
      if (!dragging) return;
      dragging = false;
      modalTrack.style.transition = "";
      var clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      var dx = clientX - startX;
      if (dx < -40 && currentSlide < slideCount - 1) {
        goToSlide(currentSlide + 1);
      } else if (dx > 40 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      } else {
        goToSlide(currentSlide);
      }
    }
    modalSlider.addEventListener("touchend", finish);
    modalSlider.addEventListener("touchcancel", finish);

    /* Мышь для десктопа: перетаскивание */
    modalSlider.addEventListener("mousedown", function (e) {
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      modalTrack.style.transition = "none";
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging || startX === null) return;
      var dx = e.clientX - startX;
      var offset = -currentSlide * width() + dx;
      modalTrack.style.transform = "translateX(" + offset + "px)";
    });
    window.addEventListener("mouseup", function (e) {
      if (!dragging) return;
      finish(e);
    });
  })();

  /* ================= Лайтбокс: фото на весь экран, как в маркетплейсах =================
     Открытие — тап по большому фото в карточке товара. Пинч — зум 1–4×,
     палец — перетаскивание, свайп (при 1×) — листание, тап/×/Esc — закрыть.
     На ПК: колесо — зум, двойной клик — 2×, перетаскивание мышью. */
  var lb = document.getElementById("lightbox");
  var lbTrack = document.getElementById("lb-track");
  var lbStage = document.getElementById("lb-stage");
  var lbDots = document.getElementById("lb-dots");
  var lbImgs = [], lbIdx = 0, lbScale = 1, lbPanX = 0, lbPanY = 0;

  function lbActive() { return lbImgs[lbIdx]; }

  function lbApply() {
    var img = lbActive();
    if (img) img.style.transform = "translate(" + lbPanX + "px," + lbPanY + "px) scale(" + lbScale + ")";
  }

  function lbClampPan() {
    if (lbScale <= 1) { lbPanX = 0; lbPanY = 0; return; }
    var mx = (lbScale - 1) * lbStage.clientWidth / 2;
    var my = (lbScale - 1) * lbStage.clientHeight / 2;
    lbPanX = Math.max(-mx, Math.min(mx, lbPanX));
    lbPanY = Math.max(-my, Math.min(my, lbPanY));
  }

  function lbZoomTo(s, keepPan) {
    lbScale = Math.max(1, Math.min(4, s));
    if (!keepPan) { lbPanX = 0; lbPanY = 0; }
    lbClampPan();
    lbApply();
  }

  function lbShow(i) {
    lbIdx = Math.max(0, Math.min(lbImgs.length - 1, i));
    lbTrack.style.transform = "translateX(-" + (lbIdx * 100) + "%)";
    lbZoomTo(1);
    lbDots.querySelectorAll(".lightbox__dot").forEach(function (d, di) {
      d.classList.toggle("is-active", di === lbIdx);
    });
  }

  function lbOpen(photos, index) {
    lbTrack.innerHTML = "";
    lbDots.innerHTML = "";
    lbImgs = [];
    photos.forEach(function (ph, i) {
      var img = document.createElement("img");
      img.src = "assets/img/" + ph.file;
      img.alt = ph.alt;
      img.draggable = false;
      lbTrack.appendChild(img);
      lbImgs.push(img);
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "lightbox__dot" + (i === index ? " is-active" : "");
      dot.setAttribute("aria-label", "Фото " + (i + 1) + " из " + photos.length);
      lbDots.appendChild(dot);
    });
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lbShow(index || 0);
    lb.querySelector(".lightbox__close").focus();
  }

  function lbClose() {
    lb.hidden = true;
    document.body.style.overflow = "hidden";   /* модалка товара осталась открыта */
    lbZoomTo(1);
  }

  /* Гашение синтетического клика после жеста (пинч/свайп не должны
     закрывать просмотр «случайным» кликом, который шлёт браузер) */
  var lbClickSuppress = false;
  function lbSuppressClick() {
    lbClickSuppress = true;
    setTimeout(function () { lbClickSuppress = false; }, 350);
  }

  lb.addEventListener("click", function (e) {
    if (lbClickSuppress) return;
    /* × и фон закрывают; тап по самой фотографии при 1x — тоже
       (как в маркетплейсах). При зуме тап нужен для пана — не закрываем. */
    if (e.target.closest("[data-lb-close]") || (e.target.tagName === "IMG" && lbScale === 1)) lbClose();
  });

  /* ---- жесты: пинч / пан / свайп (тач) ----
     Список активных пальцев берём из e.touches — браузер сам его ведёт,
     ручной учёт по identifier ломается на multi-touch в CDP/реальных
     устройствах (второй палец приходит отдельным touchstart). */
  (function () {
    var pinch0 = null;      /* {d0, scale} */
    var pan0 = null;        /* {x, y} точка старта пана */
    var swipe0 = null;      /* {x} старт свайпа при 1x */

    function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

    lbStage.addEventListener("touchstart", function (e) {
      if (e.touches.length >= 2) {
        pinch0 = { d0: dist(e.touches[0], e.touches[1]) || 1, scale: lbScale };
        swipe0 = pan0 = null;
        lbActive().style.transition = "none";
      } else if (lbScale > 1) {
        pan0 = { x: e.touches[0].clientX - lbPanX, y: e.touches[0].clientY - lbPanY };
        lbActive().style.transition = "none";
      } else {
        swipe0 = { x: e.touches[0].clientX };
      }
    }, { passive: true });

    lbStage.addEventListener("touchmove", function (e) {
      if (e.touches.length >= 2 && pinch0) {
        e.preventDefault();
        var d = dist(e.touches[0], e.touches[1]);
        lbScale = Math.max(1, Math.min(4, pinch0.scale * d / pinch0.d0));
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        lbApply();
      } else if (e.touches.length === 1 && pan0 && lbScale > 1) {
        e.preventDefault();
        lbPanX = e.touches[0].clientX - pan0.x;
        lbPanY = e.touches[0].clientY - pan0.y;
        lbClampPan();
        lbApply();
      } else if (e.touches.length === 1 && swipe0 && lbScale === 1 && lbImgs.length > 1) {
        var dx = e.touches[0].clientX - swipe0.x;
        lbTrack.style.transition = "none";
        lbTrack.style.transform = "translateX(calc(-" + (lbIdx * 100) + "% + " + dx + "px))";
      }
    }, { passive: false });

    function finish(e) {
      if (swipe0 && lbScale === 1 && lbImgs.length > 1) {
        lbTrack.style.transition = "";
        var dx = (e.changedTouches[0].clientX - swipe0.x);
        if (dx < -50) lbShow(lbIdx + 1);
        else if (dx > 50) lbShow(lbIdx - 1);
        else lbShow(lbIdx);
        lbSuppressClick();
      }
      if (pinch0) {
        lbActive().style.transition = "";
        lbClampPan();
        if (lbScale <= 1.04) lbZoomTo(1);
        else lbApply();
        lbSuppressClick();
      }
      pan0 = pinch0 = swipe0 = null;
    }
    lbStage.addEventListener("touchend", finish);
    lbStage.addEventListener("touchcancel", finish);

    /* ПК: колесо — зум, двойной клик — 2x, перетаскивание мышью */
    lbStage.addEventListener("wheel", function (e) {
      e.preventDefault();
      lbActive().style.transition = "";
      lbZoomTo(lbScale * (e.deltaY < 0 ? 1.15 : 0.87), true);
    }, { passive: false });
    lbStage.addEventListener("dblclick", function () {
      if (lbScale > 1) lbZoomTo(1);
      else lbZoomTo(2.5);
    });
    var mouse = null;
    lbStage.addEventListener("mousedown", function (e) {
      if (lbScale > 1) { mouse = { x: e.clientX - lbPanX, y: e.clientY - lbPanY }; lbActive().style.transition = "none"; e.preventDefault(); }
    });
    window.addEventListener("mousemove", function (e) {
      if (!mouse) return;
      lbPanX = e.clientX - mouse.x;
      lbPanY = e.clientY - mouse.y;
      lbClampPan();
      lbApply();
    });
    window.addEventListener("mouseup", function () {
      if (mouse) { lbActive().style.transition = ""; mouse = null; }
    });
  })();

  /* Тап по большому фото в карточке товара — открыть просмотр с текущего кадра.
     Свайп-перелистывание слайдера просмотр не открывает. */
  (function () {
    var sliderDragged = false;
    modalSlider.addEventListener("touchmove", function () { sliderDragged = true; }, { passive: true });
    modalSlider.addEventListener("touchend", function () {
      setTimeout(function () { sliderDragged = false; }, 120);
    });
    modalSlider.addEventListener("click", function (e) {
      if (sliderDragged || !modalProduct) return;
      if (e.target.closest(".modal__dot")) return;   /* точка = листание, не просмотр */
      lbOpen(modalProduct.photos, currentSlide);
    });
  })();

  function openModal(product) {
    lastFocused = document.activeElement;
    shareProduct = product;
    modalProduct = product;

    modalLatin.textContent = product.latin;
    modalTitle.textContent = product.name;

    var priceText = fmtPrice(product);
    if (product.priceMin !== product.priceMax) {
      priceText += " (в зависимости от размера)";
    }
    modalPrice.innerHTML = "<span></span> <small></small>";
    modalPrice.querySelector("span").textContent = priceText;
    modalPrice.querySelector("small").textContent =
      volumeLabel(product) + (product.age ? " · " + product.age : "");

    modalDesc.textContent = product.description;

    modalTraits.innerHTML = "";
    product.traits.forEach(function (trait) {
      var row = document.createElement("div");
      var dt = document.createElement("dt");
      var dd = document.createElement("dd");
      dt.textContent = trait.label;
      dd.textContent = trait.value;
      row.appendChild(dt);
      row.appendChild(dd);
      modalTraits.appendChild(row);
    });

    renderSlider(product);

    var stock = stockInfo(product);
    modalAdd.disabled = !!stock.disabled;
    modalAdd.textContent = stock.disabled ? "Продано" : "В корзину";
    refreshAddButton(modalAdd, product);
    modalAdd.onclick = function (event) {
      if (stock.disabled) return;
      addToCart(product);
      flyToCart(event, product);
      refreshAddButton(modalAdd, product);
      modalAdd.classList.add("is-added");
      setTimeout(function () { modalAdd.classList.remove("is-added"); }, 900);
    };

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".modal__close").focus();
  }

  function closeModal(el) {
    el.hidden = true;
    if (el === modal && openedFromCart) {
      /* карточка была открыта из корзины — возвращаем в корзину
         и перерисовываем её (изменения из карточки уже в localStorage) */
      openedFromCart = false;
      modal.classList.remove("open-over-cart");
      renderCart();
      cartModal.hidden = false;
      document.body.style.overflow = "hidden";
      cartModal.querySelector(".modal__close").focus();
      return;
    }
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  [modal, cartModal].forEach(function (el) {
    el.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]")) closeModal(el);
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      /* Esc закрывает ВЕРХНИЙ слой: лайтбокс → модалка товара → корзина */
      if (!lb.hidden) { lbClose(); return; }
      if (!modal.hidden) closeModal(modal);
      else if (!cartModal.hidden) closeModal(cartModal);
    }
  });

  /* ================= Поделиться карточкой товара =================
     Телефон: системная шторка (MAX, WhatsApp, SMS…).
     ПК/старые браузеры: ссылка копируется в буфер. */
  document.getElementById("modal-share").addEventListener("click", function () {
    if (!shareProduct) return;
    var price = fmtPrice(shareProduct);
    var url = location.origin + location.pathname;
    var text = shareProduct.name + " — " + price + ". Питомник «Чудный сад»";
    if (navigator.share) {
      navigator.share({ title: "Чудный сад", text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " · " + url).then(function () {
        shareTxt.textContent = "Скопировано ✓";
        setTimeout(function () { shareTxt.textContent = "Поделиться"; }, 1600);
      });
    }
  });

  /* ================= Корзина: окно и оформление ================= */

  var cartItems = document.getElementById("cart-items");
  var cartTotal = document.getElementById("cart-total");
  var stepList = document.getElementById("cart-step-list");
  var stepForm = document.getElementById("cart-step-form");
  var stepDone = document.getElementById("cart-step-done");
  var orderName = document.getElementById("order-name");
  var orderPhone = document.getElementById("order-phone");
  var orderError = document.getElementById("order-error");
  var orderPreview = document.getElementById("order-preview");

  function openCart() {
    /* Летящая в корзину картинка не должна летать поверх открытого окна */
    document.querySelectorAll(".fly-img").forEach(function (f) { f.remove(); });
    showCartStep(stepList);
    renderCart();
    cartModal.hidden = false;
    document.body.style.overflow = "hidden";
    cartModal.querySelector(".modal__close").focus();
  }

  function closeCart() {
    cartModal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  /* Карточка товара поверх корзины: флажок заставляет closeModal
     вернуть пользователя в корзину и перерисовать её содержимое —
     изменения из карточки (добавил/убрал) попадут в список. */
  var openedFromCart = false;

  function openCartProduct(product) {
    openedFromCart = true;
    modal.classList.add("open-over-cart");   /* карточка поверх корзины */
    openModal(product);
  }

  function showCartStep(step) {
    [stepList, stepForm, stepDone].forEach(function (s) { s.hidden = true; });
    step.hidden = false;
    cartModal.querySelector(".modal__close").focus();
  }

  function renderCart() {
    cartItems.innerHTML = "";
    var entries = cartEntries();

    var checkout = document.getElementById("cart-checkout");
    if (entries.length === 0) {
      var empty = document.createElement("p");
      empty.className = "cart__empty";
      empty.textContent = "Корзина пуста. Загляните в каталог — там растения ждут вас.";
      cartItems.appendChild(empty);
      cartTotal.textContent = "";
      checkout.disabled = true;
      checkout.style.opacity = ".55";
      return;
    }

    checkout.disabled = false;
    checkout.style.opacity = "";

    entries.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "cart-item";

      /* Фото и название кликабельны: карточка товара открывается ПОВЕРХ
         корзины, после закрытия пользователь вернётся в корзину. */
      var product = products.find(function (p) { return p.uid === item.uid; });
      var photoBtn = document.createElement("button");
      photoBtn.type = "button";
      photoBtn.className = "cart-item__photo-btn";
      photoBtn.setAttribute("aria-label", "Открыть карточку: " + item.name);
      var photo = document.createElement("img");
      photo.className = "cart-item__photo";
      photo.src = "assets/img/" + item.photo;
      photo.alt = "";
      photoBtn.appendChild(photo);
      if (product) {
        photoBtn.addEventListener("click", function () {
          openCartProduct(product);
        });
      }

      var info = document.createElement("div");
      info.innerHTML = '<p class="cart-item__name"></p><p class="cart-item__price"></p>';
      info.querySelector(".cart-item__name").textContent = item.name;
      info.querySelector(".cart-item__price").textContent = item.priceLabel;
      /* При одной цене серый диапазон под названием дублирует сумму справа */
      info.querySelector(".cart-item__price").style.display = item.range ? "" : "none";
      if (product) {
        info.classList.add("cart-item__info--link");
        info.addEventListener("click", function () {
          openCartProduct(product);
        });
      }

      var controls = document.createElement("div");
      controls.className = "cart-item__controls";

      var sum = document.createElement("p");
      sum.className = "cart-item__sum";
      sum.textContent = fmtRub(item.price * item.qty);

      var qty = document.createElement("div");
      qty.className = "cart-item__qty";
      var minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Убавить количество: " + item.name);
      var count = document.createElement("span");
      count.textContent = item.qty;
      var plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Прибавить количество: " + item.name);
      qty.appendChild(minus);
      qty.appendChild(count);
      qty.appendChild(plus);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-item__remove";
      remove.textContent = "убрать";
      remove.addEventListener("click", function () {
        delete cart[item.uid];
        saveCart();
        renderCart();
      });

      minus.addEventListener("click", function () {
        item.qty -= 1;
        if (item.qty <= 0) delete cart[item.uid];
        saveCart();
        renderCart();
      });
      plus.addEventListener("click", function () {
        item.qty += 1;
        saveCart();
        renderCart();
      });

      controls.appendChild(sum);
      controls.appendChild(qty);
      controls.appendChild(remove);

      row.appendChild(photoBtn);
      row.appendChild(info);
      row.appendChild(controls);
      cartItems.appendChild(row);
    });

    cartTotal.textContent = "Итого: " + fmtRub(cartTotalSum());
  }

  function buildOrderText() {
    var lines = ["Здравствуйте! Заказ с сайта chudni-sad.ru.", "",
      "Имя: " + orderName.value.trim(),
      "Телефон: " + orderPhone.value.trim(), "", "Состав заказа:"];

    cartEntries().forEach(function (item, i) {
      lines.push((i + 1) + ". " + item.name + " — " + item.qty + " шт × " +
        fmtRub(item.price) + " = " + fmtRub(item.price * item.qty));
    });
    lines.push("", "Итого: " + fmtRub(cartTotalSum()));
    return lines.join("\n");
  }

  document.getElementById("cart-checkout").addEventListener("click", function () {
    if (cartTotalCount() === 0) return;
    orderError.textContent = "";
    showCartStep(stepForm);
    setTimeout(function () { orderName.focus(); }, 60);
  });

  document.getElementById("order-back").addEventListener("click", function () {
    showCartStep(stepList);
  });

  /* Телефон: фиксированный префикс +7, ввод только цифр,
     маска +7 (XXX) XXX-XX-XX собирается сама */
  orderPhone.addEventListener("focus", function () {
    if (!orderPhone.value) {
      orderPhone.value = "+7 ";
      setPhoneCaretToEnd();
    }
  });
  orderPhone.addEventListener("input", function () {
    var digits = orderPhone.value.replace(/\D/g, "");
    if (digits.charAt(0) === "7" || digits.charAt(0) === "8") digits = digits.slice(1);
    digits = digits.slice(0, 10);

    var out = "+7";
    if (digits.length > 0) out += " (" + digits.slice(0, 3);
    if (digits.length >= 3) out += ")";
    if (digits.length > 3) out += " " + digits.slice(3, 6);
    if (digits.length > 6) out += "-" + digits.slice(6, 8);
    if (digits.length > 8) out += "-" + digits.slice(8, 10);

    orderPhone.value = out;
    setPhoneCaretToEnd();
  });
  function setPhoneCaretToEnd() {
    /* Каретка всегда в конец: бабушке проще дописывать номер */
    setTimeout(function () {
      orderPhone.setSelectionRange(orderPhone.value.length, orderPhone.value.length);
    }, 0);
  }

  document.getElementById("order-send").addEventListener("click", function () {
    var name = orderName.value.trim();
    var phone = orderPhone.value.trim();
    var digits = phone.replace(/\D/g, "");

    if (name.length < 2) {
      orderError.textContent = "Напишите, пожалуйста, имя — как к вам обращаться.";
      orderName.focus();
      return;
    }
    if (digits.length < 10) {
      orderError.textContent = "Проверьте телефон: нужно не меньше 10 цифр, например +7 924 707-14-00.";
      orderPhone.focus();
      return;
    }

    orderError.textContent = "";
    var text = buildOrderText();
    orderPreview.textContent = text;

    /* Отправка: если задан maxOrderEndpoint (релей → бот MAX), кнопка
       «Отправить в MAX» отправляет заказ автоматически. Пока не задан —
       копируем текст, покупатель вставит его в чат MAX. */
    var maxBtn = document.getElementById("order-max");
    if (shop.maxOrderEndpoint) {
      maxBtn.classList.remove("is-disabled");
      maxBtn.removeAttribute("aria-disabled");
      maxBtn.textContent = "Отправить в MAX";
      maxBtn.onclick = function (event) {
        event.preventDefault();
        maxBtn.textContent = "Отправляем…";
        fetch(shop.maxOrderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: orderName.value.trim(),
            phone: orderPhone.value.trim(),
            items: cartEntries().map(function (item) {
              return { name: item.name, qty: item.qty, price: item.price };
            }),
            total: cartTotalSum(),
            text: text
          })
        }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          document.getElementById("copy-ok").textContent =
            "Заказ отправлен! Мы свяжемся с вами по телефону.";
          document.getElementById("copy-ok").hidden = false;
          maxBtn.textContent = "Отправлено ✓";
        }).catch(function () {
          document.getElementById("copy-ok").textContent =
            "Не получилось отправить. Скопируйте текст заказа и отправьте в чат MAX.";
          document.getElementById("copy-ok").hidden = false;
          maxBtn.textContent = "Отправить в MAX";
        });
      };
    } else {
      maxBtn.classList.add("is-disabled");
      maxBtn.setAttribute("aria-disabled", "true");
maxBtn.textContent = "Отправить в MAX";
    }

    document.getElementById("copy-ok").hidden = true;
    showCartStep(stepDone);
  });

  document.getElementById("order-copy").addEventListener("click", function () {
    var text = orderPreview.textContent;
    var done = document.getElementById("copy-ok");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done.hidden = false; });
    } else {
      var area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      done.hidden = false;
    }
  });

  document.getElementById("cart-open").addEventListener("click", openCart);

  /* ================= Hero: автослайд-шоу фотографий ================= */
  /* Случайный порядок, кроссфейд 600мс + лёгкий зум (стиль Ковальски:
     только opacity/transform, сильный ease-out, смена раз в 3,5 сек).
     Бирка на фото меняется вместе с фотографией. */
  var heroSlider = document.getElementById("hero-slider");
  var heroTagLatin = document.getElementById("hero-tag-latin");
  var heroTagHand = document.getElementById("hero-tag-hand");
  if (heroSlider) {
    var pool = [];
    products.forEach(function (p) {
      p.photos.forEach(function (ph) {
        if (!pool.some(function (x) { return x.file === ph.file; })) {
          pool.push({ file: ph.file, alt: ph.alt, product: p });
        }
      });
    });
    for (var sh = pool.length - 1; sh > 0; sh--) {
      var r = Math.floor(Math.random() * (sh + 1));
      var tmp = pool[sh]; pool[sh] = pool[r]; pool[r] = tmp;
    }

    function heroCaption(entry) {
      var p = entry.product;
      var quoted = (p.name.match(/«([^»]+)»/) || [])[1];
      var extra = p.age ? p.age : (p.volume ? volumeLabel(p) : "");
      heroTagLatin.textContent = p.latin;
      heroTagHand.textContent = quoted
        ? "«" + quoted + "»" + (extra ? " · " + extra : "")
        : p.name;
    }

    var heroImgs = [];
    pool.forEach(function (entry, i) {
      var img = document.createElement("img");
      img.src = "assets/img/" + entry.file;
      img.alt = i === 0 ? "Фотографии растений питомника «Чудный сад»" : "";
      if (i === 0) {
        img.classList.add("is-active");
        heroCaption(entry);
      }
      heroSlider.appendChild(img);
      heroImgs.push(img);
    });

    var heroIdx = 0;
    var heroProduct = pool[0].product;
    var heroSuppress = false;
    var heroTapped = null;   /* товар, зафиксированный в момент жеста/тапа */

    function showHero(i) {
      heroIdx = ((i % pool.length) + pool.length) % pool.length;
      heroImgs.forEach(function (im, k) {
        im.classList.toggle("is-active", k === heroIdx);
        im.style.transform = "";
        im.style.transition = "";
      });
      heroCaption(pool[heroIdx]);
      heroProduct = pool[heroIdx].product;
    }

    /* Автосмена раз в 3,5 сек; после ручной перемотки таймер начинается заново */
    var heroTimer = null;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function startHeroTimer() {
      if (reduceMotion || pool.length < 2) return;
      if (heroTimer) clearInterval(heroTimer);
      heroTimer = setInterval(function () { showHero(heroIdx + 1); }, 3500);
    }
    startHeroTimer();

    /* Свайп влево/вправо по фото; тап — открыть карточку текущего товара */
    var hx = null, hswiping = false;
    function heroDrag(dx) {
      var cur = heroImgs[heroIdx];
      cur.style.transition = "none";
      cur.style.transform = "translateX(" + (dx * 0.25) + "px) scale(1)";
    }
    function heroGestureEnd(dx) {
      var cur = heroImgs[heroIdx];
      cur.style.transition = "";
      cur.style.transform = "";
      if (hswiping) {
        if (dx < -40) showHero(heroIdx + 1);
        else if (dx > 40) showHero(heroIdx - 1);
        startHeroTimer();
        heroTapped = heroProduct;          /* что видит пользователь сейчас */
        heroSuppress = true;
        setTimeout(function () { heroSuppress = false; }, 120);
      } else {
        heroTapped = heroProduct;          /* обычный тап без свайпа */
      }
      hx = null;
      hswiping = false;
    }

    /* Пинч-зум главного фото: два пальца — увеличение до 3x для
       детального просмотра, отпускание — плавный возврат кадра.
       Вертикальный скролл страницы не мешает (touch-action: pan-y). */
    var hp = null;   /* {d0} стартовое расстояние между пальцами */

    heroSlider.addEventListener("touchstart", function (e) {
      if (e.touches.length >= 2) {
        var a = e.touches[0], b = e.touches[1];
        hp = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
        hx = null;   /* пинч отменяет свайп */
        if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
        heroImgs[heroIdx].style.transition = "none";
        heroSlider.classList.add("is-zooming");   /* бирку на фото — убрать */
      } else {
        heroTapped = heroProduct;            /* кадр зафиксирован на старте касания */
        hx = e.touches[0].clientX;
        hswiping = false;
      }
    }, { passive: true });

    heroSlider.addEventListener("touchmove", function (e) {
      if (hp && e.touches.length >= 2) {
        var a = e.touches[0], b = e.touches[1];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        var s = Math.max(1, Math.min(3, d / hp.d0));
        var rect = heroSlider.getBoundingClientRect();
        var cx = (a.clientX + b.clientX) / 2 - rect.left - rect.width / 2;
        var cy = (a.clientY + b.clientY) / 2 - rect.top - rect.height / 2;
        heroImgs[heroIdx].style.transform =
          "translate(" + (cx * 0.6) + "px," + (cy * 0.6) + "px) scale(" + s + ")";
        return;
      }
      if (hx === null || pool.length < 2) return;
      var dx = e.touches[0].clientX - hx;
      var dy = e.touches[0].clientY - heroSlider.getBoundingClientRect().top;
      if (!hswiping) {
        if (Math.abs(dx) > 12) {
          hswiping = true;
          if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
        } else return;
      }
      heroDrag(dx);
    }, { passive: true });

    heroSlider.addEventListener("touchend", function (e) {
      if (hp) {
        /* конец пинча: плавно возвращаем кадр на место */
        var cur = heroImgs[heroIdx];
        cur.style.transition = "transform .35s cubic-bezier(.23, 1, .32, 1)";
        cur.style.transform = "";
        setTimeout(function () { cur.style.transition = ""; }, 400);
        heroSlider.classList.remove("is-zooming");
        startHeroTimer();
        hp = null;
        hx = null;
        heroSuppress = true;   /* зум не должен открыть карточку случайным тапом */
        setTimeout(function () { heroSuppress = false; }, 250);
        return;
      }
      if (hx === null) return;
      heroGestureEnd(e.changedTouches[0].clientX - hx);
    });

    heroSlider.addEventListener("mousedown", function (e) {
      if (pool.length < 2) return;
      heroTapped = heroProduct;
      hx = e.clientX;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (hx === null) return;
      var dx = e.clientX - hx;
      if (Math.abs(dx) > 5) {
        hswiping = true;
        if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
        heroDrag(dx);
      }
    });
    window.addEventListener("mouseup", function (e) {
      if (hx === null) return;
      heroGestureEnd(e.clientX - hx);
    });

    heroSlider.addEventListener("click", function () {
      if (heroSuppress) return;
      var product = heroTapped || heroProduct;
      heroTapped = null;
      if (product) openModal(product);
    });
  }

  /* ================= Кнопка «В начало» =================
     ПК: постоянная после прокрутки экрана. Телефон: видна во время
     прокрутки и гаснет через 1,5 сек покоя — не висит над контентом. */
  var toTopFadeTimer = null;
  function updateToTop() {
    var b = document.getElementById("to-top");
    if (!b) return;
    var show = window.scrollY > window.innerHeight;
    b.classList.toggle("is-active", show);
    if (window.matchMedia("(max-width: 700px)").matches && show) {
      if (toTopFadeTimer) clearTimeout(toTopFadeTimer);
      toTopFadeTimer = setTimeout(function () {
        if (window.scrollY > window.innerHeight) b.classList.remove("is-active");
      }, 1500);
    }
  }
  window.addEventListener("scroll", updateToTop, { passive: true });
  updateToTop();
  var toTopBtn = document.getElementById("to-top");
  if (toTopBtn) toTopBtn.addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ================= Полёт в корзину и бейджи количества ================= */

  function flyToCart(event, product) {
    var cartBtn = document.getElementById("cart-open");
    var cartRect = cartBtn.getBoundingClientRect();

    /* Начало: кнопка «В корзину», из которой прилетело событие */
    var fromRect = (event.currentTarget && event.currentTarget.getBoundingClientRect)
      ? event.currentTarget.getBoundingClientRect()
      : { left: cartRect.left, top: cartRect.top, width: 0, height: 0 };

    var fromX = fromRect.left + fromRect.width / 2 - 32;
    var fromY = fromRect.top + fromRect.height / 2 - 32;
    var toX = cartRect.left + cartRect.width / 2 - 32;
    var toY = cartRect.top + cartRect.height / 2 - 32;

    var img = document.createElement("img");
    img.src = "assets/img/" + product.photos[0].file;
    img.className = "fly-img";
    img.alt = "";
    img.style.left = fromX + "px";
    img.style.top = fromY + "px";
    img.style.setProperty("--fly-dx", (toX - fromX) + "px");
    img.style.setProperty("--fly-dy", (toY - fromY) + "px");

    document.body.appendChild(img);
    img.classList.add("is-flying");
    setTimeout(function () { img.remove(); }, 750);

    /* Подсветка корзины в момент «прилёта» */
    setTimeout(function () {
      cartBtn.classList.add("is-popping");
      setTimeout(function () { cartBtn.classList.remove("is-popping"); }, 500);
    }, 550);
  }

  function refreshAddButton(button, product) {
    var entry = cart[product.uid];
    var n = entry ? entry.qty : 0;
    /* У карточек текст живёт в .card__add-txt, у кнопки модалки — прямо
       в кнопке; бейдж с числом виден только в компактной карточке. */
    var txt = button.querySelector(".card__add-txt");
    var badge = button.querySelector(".add-badge");
    if (txt) txt.textContent = n > 0 ? "В корзине " + n : "В корзину";
    else button.textContent = n > 0 ? "В корзине " + n : "В корзину";
    if (badge) {
      badge.textContent = n;
      badge.classList.toggle("is-on", n > 0);
    }
    /* Зелёный = позиция уже в корзине (видно на карточке и в модалке) */
    button.classList.toggle("btn--in-cart", n > 0);
  }

  /* Обновляем надписи на ВСЕХ кнопках каталога — чтобы карточка
     отражала корзину, даже если товар добавили из модалки */
  function refreshAllAddButtons() {
    document.querySelectorAll("button.card__add[data-uid]").forEach(function (btn) {
      var uid = btn.getAttribute("data-uid");
      var product = products.find(function (p) { return p.uid === uid; });
      if (product) refreshAddButton(btn, product);
    });
  }

  /* ================= Контакты ================= */

  var phoneHref = "tel:+" + shop.phoneRaw.replace(/\D/g, "");
  ["contacts-phone", "bar-phone"].forEach(function (id) {
    var link = document.getElementById(id);
    if (link) link.href = phoneHref;
  });

  var contactsMax = document.getElementById("contacts-max");
  if (contactsMax) contactsMax.href = shop.max;

  var barMax = document.getElementById("bar-max");
  if (barMax) barMax.href = shop.max;

  var phoneLabel = document.getElementById("contacts-phone-label");
  if (phoneLabel) phoneLabel.textContent = shop.phone + " · " + shop.contactName;

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ================= Хиты сезона: горизонтальная лента ================= */
  function renderFeatured() {
    var row = document.getElementById("featured-row");
    var sec = document.getElementById("featured");
    if (!row || !sec) return;
    var seen = {};
    var hits = products.filter(function (p) {
      if (!p.featured || seen[p.id]) return false;
      seen[p.id] = 1;
      return true;
    });
    if (!hits.length) { sec.style.display = "none"; return; }
    hits.forEach(function (p, i) {
      var card = document.createElement("article");
      card.className = "featured-card";
      card.style.animationDelay = (Math.min(i, 8) * 60) + "ms";

      var photo = document.createElement("button");
      photo.type = "button";
      photo.className = "featured-card__photo";
      photo.setAttribute("aria-label", "Подробнее о: " + p.name);
      var img = document.createElement("img");
      img.src = "assets/img/" + p.photos[0].file;
      img.alt = p.photos[0].alt;
      img.loading = "lazy";
      img.decoding = "async";
      photo.appendChild(img);
      photo.addEventListener("click", function () { openModal(p); });

      var body = document.createElement("div");
      body.className = "featured-card__body";
      var name = document.createElement("p");
      name.className = "featured-card__name";
      name.textContent = p.name;

      var rowEl = document.createElement("div");
      rowEl.className = "featured-card__row";
      var price = document.createElement("span");
      price.className = "featured-card__price";
      price.textContent = fmtPrice(p);

      var add = document.createElement("button");
      add.type = "button";
      add.className = "featured-card__add";
      if (stockInfo(p).disabled) {
        add.remove();
      } else {
        add.innerHTML = CART_ICON_SVG;
        add.setAttribute("aria-label", "В корзину: " + p.name);
        add.addEventListener("click", function () {
          addToCart(p);
          add.innerHTML = "✓";
          add.classList.add("is-added");
          setTimeout(function () {
            add.innerHTML = CART_ICON_SVG;
            add.classList.remove("is-added");
          }, 900);
        });
      }

      rowEl.appendChild(price);
      rowEl.appendChild(add);
      body.appendChild(name);
      body.appendChild(rowEl);
      card.appendChild(photo);
      card.appendChild(body);
      row.appendChild(card);
    });
  }

  /* ================= PWA: работа сайта как приложения =================
     Chrome на Android сам предложит «Добавить на главный экран»
     (manifest + service worker + HTTPS). На iPhone — «На экран “Домой”»
     в меню Safari. Регистрация не мешает работе без интернета. */
  if ("serviceWorker" in navigator &&
      (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* В Яндекс.Браузере на телефоне есть своя кнопка «наверх» — свою прячем */
  if (/YaBrowser|Yowser/i.test(navigator.userAgent) &&
      window.matchMedia("(max-width: 700px)").matches) {
    document.documentElement.classList.add("hide-totop");
  }

  renderTabs();
  renderCards();
  applyViewMode();
  renderFeatured();
  refreshAllAddButtons();
  updateCartBadge();
  renderFilterPanel();
  updateFilterBadge();
})();
