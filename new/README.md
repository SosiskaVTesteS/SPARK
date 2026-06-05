# SPARK Preloader v2 — Инструкция по установке

## Что изменилось

Старый прелоадер → Новый "SINGULARITY":
- ❌ Хаотичные частицы вихря → ✅ 12 точных геометрических лучей
- ❌ Медленный побуквенный вход → ✅ Мгновенный скан-луч по слову SPARK
- ❌ Простой blur-выход → ✅ Контрактный выход со scale+blur
- ❌ Плоский спиннер для auth-пользователей → ✅ Иридесцентная дуга
- ✅ Длительность: ~1.75 сек (короче на ~2 сек!)
- ✅ Canvas: только управляемая геометрия, 0 random

---

## Шаг 1 — HTML (index.html)

Найди в `index.html`:
```
<!-- ════ INTRO ANIMATION SCREEN ════ -->
<div id="sparkIntro" ...>
  ...
</div>
```

Замени весь этот `<div>` содержимым файла **`1_HTML_sparkIntro.html`**.

---

## Шаг 2 — CSS (assets/css/animations.css)

Найди блок с комментарием:
```
/* ═... INTRO SCREEN #sparkIntro ... */
```

Замени **весь этот блок** (от `#sparkIntro {` до `.si-tagline { ... }` включительно)
содержимым файла **`2_CSS_intro_section.css`**.

> Остальные части animations.css (RIPPLE, SKELETON, etc.) — не трогай.

---

## Шаг 3 — JavaScript (assets/js/animations.js)

Найди блок:
```js
var IntroEngine = {
  STORAGE_KEY: 'spark_intro_v1',
  ...
};
```

Замени его **целиком** содержимым файла **`3_JS_IntroEngine.js`**.

> Все остальные engines (RippleEngine, StarFieldEngine, etc.) — без изменений.

---

## Шаг 4 — launchOverlay (index.html, тег `<head>`)

Найди в `<head>` блок `<style>` с `#launchOverlay`.
Замени его содержимым из файла **`4_launchOverlay_style.html`**.

---

## Результат

После деплоя:
- Новые пользователи: видят новый прелоадер при первом открытии
- Старые пользователи: тоже увидят новый прелоадер — STORAGE_KEY сменился с
  `spark_intro_v1` → `spark_intro_v2`, sessionStorage сбросится
- Каждую сессию прелоадер показывается 1 раз (как и раньше)
