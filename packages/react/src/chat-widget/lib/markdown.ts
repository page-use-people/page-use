import {Marked} from 'marked';

const marked = new Marked({
    async: false,
    gfm: true,
    breaks: false,
    renderer: {
        html() {
            return '';
        },
        link({href, title, tokens}) {
            if (/^javascript:/i.test(href ?? '')) {
                return this.parser.parseInline(tokens);
            }

            const titleAttr = title ? ` title="${title}"` : '';
            const text = this.parser.parseInline(tokens);
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        },
    },
});

export const parseMarkdown = (source: string): string =>
    marked.parse(source) as string;

const markdownSheet = new CSSStyleSheet();
markdownSheet.replaceSync(`
    .pu-md > :first-child { margin-top: 0; }
    .pu-md > :last-child { margin-bottom: 0; }
    .pu-md p { margin: 0.4em 0; }
    .pu-md strong { font-weight: 700; }
    .pu-md em { font-style: italic; }
    .pu-md code {
        background: var(--pu-surface);
        padding: 0.1em 0.35em;
        font-size: 0.875em;
    }
    .pu-md pre {
        background: var(--pu-surface);
        padding: 0.6em 0.8em;
        overflow-x: auto;
        margin: 0.5em 0;
        font-size: 0.85em;
    }
    .pu-md pre code {
        background: none;
        padding: 0;
        font-size: inherit;
    }
    .pu-md ul, .pu-md ol {
        padding-left: 1.4em;
        margin: 0.4em 0;
    }
    .pu-md ul { list-style-type: disc; }
    .pu-md ol { list-style-type: decimal; }
    .pu-md li { margin: 0.15em 0; }
    .pu-md li > p { margin: 0; }
    .pu-md blockquote {
        border-left: 3px solid var(--pu-muted);
        padding-left: 0.8em;
        margin: 0.4em 0;
        color: var(--pu-muted);
    }
    .pu-md a {
        color: var(--pu-accent);
        text-decoration: underline;
    }
    .pu-md a:hover { opacity: 0.8; }
    .pu-md h1, .pu-md h2, .pu-md h3,
    .pu-md h4, .pu-md h5, .pu-md h6 {
        font-weight: 700;
        margin: 0.6em 0 0.3em;
        line-height: 1.3;
    }
    .pu-md h1 { font-size: 1.25em; }
    .pu-md h2 { font-size: 1.15em; }
    .pu-md h3 { font-size: 1.05em; }
    .pu-md h4, .pu-md h5, .pu-md h6 { font-size: 1em; }
    .pu-md hr {
        border: none;
        border-top: 1px solid var(--pu-divider);
        margin: 0.6em 0;
    }
    .pu-md table {
        border-collapse: collapse;
        margin: 0.4em 0;
        font-size: 0.9em;
    }
    .pu-md th, .pu-md td {
        border: 1px solid var(--pu-divider);
        padding: 0.3em 0.6em;
    }
    .pu-md th {
        background: var(--pu-surface);
        font-weight: 700;
    }
`);

export const markdownStyles = markdownSheet;
