# Contract: Partner Snippet and Loader (`/embed/v1.js`)

This is the public interface that partners paste into their pages. Once published, it MUST stay
backward compatible: breaking changes ship as `/embed/v2.js` (research R5).

## Script snippet (recommended)

```html
<div
  data-digest-widget
  data-project="hht-research"
  data-partner="curehht-ru"
  data-locale="ru"
  data-items="3"
  data-theme="auto"
  data-subscribe="form"
>
  <!-- Fallback: shown until the widget is ready, and kept if it never is. -->
  <p>
    Новости исследований публикуются каждую неделю.
    <a href="https://vk.com/…">Сообщество ВКонтакте</a> ·
    <a
      href="https://hht.rarediseasedigest.org/ru/projects/hht-research?src=site:curehht-ru#subscribe"
      >Подписаться</a
    >
  </p>
</div>
<script async src="https://hht.rarediseasedigest.org/embed/v1.js"></script>
```

| Attribute                                   | Required | Values                              | Default | Invalid value →   |
| ------------------------------------------- | -------- | ----------------------------------- | ------- | ----------------- |
| `data-digest-widget`                        | yes      | (presence)                          | —       | container ignored |
| `data-project`                              | yes      | project slug                        | —       | fallback stays    |
| `data-partner`                              | yes      | partner key configured by the owner | —       | fallback stays    |
| `data-locale`                               | no       | `en` `de` `tr` `ru` `uk`            | `en`    | `en`              |
| `data-items`                                | no       | integer 1–20                        | `3`     | `3`               |
| `data-theme`                                | no       | `auto` `light` `dark`               | `auto`  | `auto`            |
| `data-subscribe`                            | no       | `form` `link`                       | `form`  | `form`            |
| `data-fallback-text` / `data-fallback-href` | no       | text / `https:` URL                 | —       | ignored           |

- The fallback markup is the partner's own HTML, written in their language. The admin's
  `embedSnippets` field and `docs/embed-widget.md` generate it in Russian and English from
  `messages/*.json` and the partner's `fallbackCommunityUrl`.
- If the container has no child elements, the loader builds `<p>{text} <a href>{href}</a></p>`
  from `data-fallback-*` (secondary path, research R5).
- One script tag serves every container on the page. Pasting the script tag twice is harmless,
  because containers are marked as processed.

## Plain frame snippet (no third-party script)

```html
<iframe
  src="https://hht.rarediseasedigest.org/embed/ru/hht-research/curehht-ru/auto-3-form"
  title="Новости исследований: последний выпуск"
  width="100%"
  height="900"
  style="border:0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  loading="lazy"
></iframe>
```

The height is fixed and set by the partner. The widget scrolls inside the frame when its content
is taller (spec FR-011). If our domain is blocked, the frame shows the browser's own error, which
is why the script snippet is recommended (spec edge case).

## Loader behavior (normative)

1. `widgetOrigin = new URL(document.currentScript.src).origin`. If `currentScript` is not
   available, the loader finds its own `<script src$="/embed/v1.js">`.
2. For each unprocessed `[data-digest-widget]`:
   1. Mark it as processed.
   2. Build `src = widgetOrigin + /embed/{locale}/{project}/{partner}/{theme}-{items}-{subscribe}`,
      with each value normalized per the table above.
   3. Create the frame with these properties:
      - `sandbox`: the same flags as the plain snippet;
      - `referrerpolicy="strict-origin-when-cross-origin"`;
      - `style`: `border:0; width:100%; height:0; visibility:hidden; position:absolute; left:0; top:0`;
      - the container gets `position: relative` if it is `static`.

      Append it to the container. The fallback stays as is.

   4. Start a **10 000 ms** timer. On timeout: remove the frame and leave the fallback.
3. One `message` listener on `window`. A message is handled only if all of these hold:
   - `event.origin === widgetOrigin`;
   - `event.source` is the `contentWindow` of a frame created by this loader;
   - `event.data` is an object with `v === 1`.
4. `digest-widget:ready { height, title }`: if the timer already fired, ignore it. Otherwise:
   - clear the timer and set `frame.title = title`;
   - hide every fallback child (`hidden`);
   - make the frame visible and static (`visibility:visible; position:static`);
   - set `height = max(height, 1) + 'px'`.
     A later `ready` from the same frame, after a form submit navigates it, only updates the height
     and title.
5. `digest-widget:size { height }`: if the frame is visible, set its height.
6. Never: write cookies or storage, read the partner page's content, call `eval`, or load any
   other resource.

## Size and compatibility

- `gzip -9 public/embed/v1.js | wc -c` must be ≤ 3072. This is enforced by a Jest test.
- Plain ES2017 (`const`/`let`, arrow functions, `URL`, `ResizeObserver` not needed on the loader
  side). It works in the last two versions of Chrome, Safari, Firefox and Samsung Internet. On
  older browsers it degrades to the fallback.
- Served with `Cache-Control: public, max-age=3600` (set in `next.config` `headers()`).
