/* texts-loader.js — применение правок текстов витрины (v54).
 * Хранилище: texts.json {selector: {text, links, style}} — правки жены через
 * визуальный редактор (vitrina_editor.py :8792). Безопасность: в файлах НЕТ
 * HTML — только плоский текст + список ссылок/стилей с белыми списками;
 * разметку строим здесь, всё экранируем (XSS исключён by design).
 * Неактивен/пусто — страница выглядит ровно как раньше. */
(function () {
  "use strict";

  var PALETTE = ["#1e3226", "#13211a", "#29422f", "#b5c96a", "#b23248",
    "#e7f0d9", "#f9faf1", "#141b10", "#ffffff"];
  var FONTS = ["Roboto", "Prata", "Caveat", "Georgia"];
  var WEIGHTS = ["400", "500", "700"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function hrefOk(u) {
    return /^(https?:\/\/|tel:|mailto:|#)/i.test(String(u)) && String(u).length <= 300;
  }

  /* N-е вхождение подстроки (n от 1; без n — все вхождения) */
  function replaceLinks(html, links) {
    (links || []).forEach(function (l) {
      var needle = esc(String(l.find || ""));
      var href = String(l.href || "");
      if (!needle || !hrefOk(href)) return;
      var a = '<a href="' + esc(href) + '" rel="noopener"' +
        (/^#/.test(href) ? "" : ' target="_blank"') + ">" + needle + "</a>";
      var n = parseInt(l.n, 10);
      if (n >= 1) {
        var idx = -1, pos = 0;
        while (n-- > 0) {
          idx = html.indexOf(needle, pos);
          if (idx < 0) return;
          pos = idx + needle.length;
        }
        html = html.slice(0, idx) + a + html.slice(idx + needle.length);
      } else {
        html = html.split(needle).join(a);
      }
    });
    return html;
  }

  function buildHtml(o) {
    var html = esc(String(o.text == null ? "" : o.text));
    return replaceLinks(html, o.links);
  }

  function applyStyle(el, st) {
    if (!st) return;
    if (st.color && PALETTE.indexOf(st.color) >= 0) el.style.color = st.color;
    if (st.fontFamily && FONTS.indexOf(st.fontFamily) >= 0)
      el.style.fontFamily = '"' + st.fontFamily + '", sans-serif';
    var fs = parseFloat(st.fontSize);
    if (fs >= 10 && fs <= 64) el.style.fontSize = fs + "px";
    if (WEIGHTS.indexOf(st.fontWeight) >= 0) el.style.fontWeight = st.fontWeight;
    if (st.textDecoration === "underline") el.style.textDecoration = "underline";
  }

  function apply(entry, el) {
    if (!entry || !el) return false;
    el.innerHTML = buildHtml(entry);
    applyStyle(el, entry.style);
    return true;
  }

  function boot() {
    fetch("texts.json", {cache: "no-cache"}).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !data.texts) return;
      var missing = [];
      Object.keys(data.texts).forEach(function (sel) {
        var el = null;
        try { el = document.querySelector(sel); } catch (e) { /* битый селектор */ }
        if (!apply(data.texts[sel], el)) missing.push(sel);
      });
      if (missing.length)
        console.warn("[texts] селекторы не найдены (HTML изменился?):", missing);
    }).catch(function () { /* нет файла — обычная страница */ });
  }

  window.TextsLoader = {apply: apply, buildHtml: buildHtml, esc: esc,
    PALETTE: PALETTE, FONTS: FONTS, WEIGHTS: WEIGHTS, hrefOk: hrefOk};
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
