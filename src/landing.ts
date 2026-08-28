import { SERVER_NAME, SERVER_VERSION } from "./server.js";
import { describeToolParameters, TOOL_SPECS, type ToolSpec } from "./tools.js";

export const SAMPLE_PROMPT = [
  "Подключись к MCP серверу Tasty Coffee по ссылке {{endpoint}}.",
  "Если нет возможности осуществлять сетевые вызовы, объясни, как подключить MCP сервер в интерфейсе.",
  "Для теста подбери три зерна для эспрессо-машины с рейтингом не ниже 4.9 — два под молочные напитки и одно под чёрный кофе, помол в зёрнах, упаковка 250 г. Пришли мне ссылку на корзину.",
].join("\n");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderParameters(spec: ToolSpec<any>): string {
  const parameters = describeToolParameters(spec);
  if (parameters.length === 0) {
    return '<div class="tool__params tool__params--empty">без параметров</div>';
  }

  const items = parameters
    .map((parameter) => {
      const flag = parameter.required
        ? '<span class="param__flag param__flag--required">обязательный</span>'
        : parameter.defaultValue === undefined
          ? '<span class="param__flag">опциональный</span>'
          : `<span class="param__flag">по умолчанию ${escapeHtml(parameter.defaultValue)}</span>`;
      const hint = parameter.description
        ? `<span class="param__hint">${escapeHtml(parameter.description)}</span>`
        : "";
      return [
        '<li class="param">',
        `<code class="param__name">${escapeHtml(parameter.name)}</code>`,
        `<span class="param__type">${escapeHtml(parameter.type)}</span>`,
        flag,
        hint,
        "</li>",
      ].join("");
    })
    .join("");

  return `<ul class="tool__params">${items}</ul>`;
}

function renderTool(spec: ToolSpec<any>): string {
  const writes = spec.annotations?.readOnlyHint === false
    ? '<span class="tool__badge tool__badge--write">изменяет данные</span>'
    : '<span class="tool__badge">только чтение</span>';

  return [
    '<article class="tool">',
    '<header class="tool__head">',
    `<code class="tool__name">${escapeHtml(spec.name)}</code>`,
    writes,
    "</header>",
    `<p class="tool__desc">${escapeHtml(spec.description)}</p>`,
    renderParameters(spec),
    "</article>",
  ].join("");
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #faf7f3;
  --panel: #ffffff;
  --panel-alt: #f3ede5;
  --border: #e3d9cc;
  --text: #2b2018;
  --muted: #7a6a5c;
  --accent: #8a5a2b;
  --accent-soft: #f0e2d2;
  --code: #4a3524;
  --shadow: 0 1px 2px rgba(43, 32, 24, .06), 0 8px 24px rgba(43, 32, 24, .06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17120e;
    --panel: #1f1913;
    --panel-alt: #262019;
    --border: #362c22;
    --text: #f2e9df;
    --muted: #a6947f;
    --accent: #d99a5b;
    --accent-soft: #33261a;
    --code: #e8d8c4;
    --shadow: none;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 48px 20px 72px;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.wrap { max-width: 820px; margin: 0 auto; }
h1 { font-size: 30px; line-height: 1.25; margin: 0 0 8px; letter-spacing: -.02em; }
h2 { font-size: 19px; margin: 40px 0 14px; letter-spacing: -.01em; }
p { margin: 0 0 14px; }
a { color: var(--accent); }
.lead { color: var(--muted); margin-bottom: 24px; }
code, pre { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }

.endpoint {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 14px 16px; margin-bottom: 22px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow);
}
.endpoint code { font-size: 15px; color: var(--code); word-break: break-all; flex: 1 1 auto; }

button.copy {
  flex: 0 0 auto; cursor: pointer;
  padding: 7px 14px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--panel-alt); color: var(--text);
  font: inherit; font-size: 14px; transition: background .15s, border-color .15s;
}
button.copy:hover { background: var(--accent-soft); border-color: var(--accent); }
button.copy.is-copied { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

.note {
  position: relative;
  padding: 16px 18px; margin-bottom: 8px;
  background: var(--panel); border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: 12px; box-shadow: var(--shadow);
}
.note__text { white-space: pre-wrap; color: var(--muted); font-size: 15px; margin-bottom: 12px; }

pre.snippet {
  margin: 0 0 14px; padding: 14px 16px; overflow-x: auto;
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  font-size: 13.5px; color: var(--code); box-shadow: var(--shadow);
}

.tools { display: grid; gap: 12px; }
.tool {
  padding: 16px 18px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow);
}
.tool__head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; }
.tool__name { font-size: 15px; font-weight: 600; color: var(--accent); }
.tool__badge {
  font-size: 11.5px; letter-spacing: .03em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 999px;
  background: var(--panel-alt); color: var(--muted); border: 1px solid var(--border);
}
.tool__badge--write { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.tool__desc { margin: 0 0 12px; color: var(--text); font-size: 15px; }
.tool__params { list-style: none; display: grid; gap: 6px; margin: 0; padding: 0; }
.tool__params--empty { color: var(--muted); font-size: 13.5px; font-style: italic; }
.param { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 13.5px; }
.param__name { color: var(--code); font-weight: 600; }
.param__type { color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.param__flag { color: var(--muted); }
.param__flag--required { color: var(--accent); }
.param__hint { flex: 1 1 100%; color: var(--muted); }

footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--muted); font-size: 14px; }
`;

const SCRIPT = `
document.addEventListener('DOMContentLoaded', function () {
  function copyText(text, button) {
    if (!text || !navigator.clipboard) { return; }
    navigator.clipboard.writeText(text).then(function () {
      var original = button.getAttribute('data-label') || button.textContent;
      button.setAttribute('data-label', original);
      button.textContent = 'Скопировано';
      button.classList.add('is-copied');
      window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove('is-copied');
      }, 1500);
    });
  }
  document.querySelectorAll('[data-copy-text]').forEach(function (button) {
    button.addEventListener('click', function () {
      copyText(button.getAttribute('data-copy-text') || '', button);
    });
  });
  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.getElementById(button.getAttribute('data-copy-target') || '');
      copyText(target ? target.textContent.trim() : '', button);
    });
  });
});
`;

export function renderLandingPage(endpointUrl: string): string {
  const endpoint = escapeHtml(endpointUrl);
  const prompt = SAMPLE_PROMPT.replace("{{endpoint}}", endpointUrl);
  const claudeConfig = JSON.stringify(
    { mcpServers: { tastycoffee: { type: "http", url: endpointUrl } } },
    null,
    2,
  );

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP сервер Tasty Coffee</title>
<meta name="description" content="MCP сервер для подбора и заказа кофе в Tasty Coffee: поиск по каталогу, цены, отзывы, рекомендации и ссылка на корзину.">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
  <h1>MCP сервер Tasty Coffee</h1>
  <p class="lead">Подключите его своему ИИ-помощнику, чтобы делегировать ему подбор кофе и сборку корзины в <a href="https://shop.tastycoffee.ru" target="_blank" rel="noopener">shop.tastycoffee.ru</a>.</p>

  <div class="endpoint">
    <code>${endpoint}</code>
    <button type="button" class="copy" data-copy-text="${endpoint}">Скопировать</button>
  </div>

  <p>Для начала работы добавьте ссылку на MCP сервер своему ИИ-помощнику, а затем отправьте ему такой запрос:</p>

  <div class="note">
    <div class="note__text" id="ai-prompt-text">${escapeHtml(prompt)}</div>
    <button type="button" class="copy" data-copy-target="ai-prompt-text">Скопировать промпт</button>
  </div>

  <h2>Как подключить</h2>
  <p>Claude Code — одной командой:</p>
  <pre class="snippet">claude mcp add --transport http tastycoffee ${endpoint}</pre>
  <p>Claude Desktop и другие клиенты с конфигом — в <code>mcpServers</code>:</p>
  <pre class="snippet">${escapeHtml(claudeConfig)}</pre>
  <p>Сервер работает по транспорту Streamable HTTP и не требует авторизации.</p>

  <h2>В настоящий момент доступны следующие тулы</h2>
  <div class="tools">
    ${TOOL_SPECS.map(renderTool).join("\n    ")}
  </div>

  <footer>
    ${escapeHtml(SERVER_NAME)} v${escapeHtml(SERVER_VERSION)} ·
    <a href="https://github.com/Muxee4ka/tastycoffee-mcp" target="_blank" rel="noopener">исходный код на GitHub</a> ·
    неофициальный проект, не связан с Tasty Coffee
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
