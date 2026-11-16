import { h, type VNode } from "vue";

export interface MarkdownOptions {
  /** 链接点击回调；未提供时链接只作为普通文本展示，避免 webview 自行跳转 */
  onLinkClick?: (url: string) => void;
}

type MarkdownChild = VNode | string;

/** 只允许在系统浏览器中打开的安全协议 */
const SAFE_PROTOCOL = /^(https?:|mailto:)/i;

const createLink = (
  label: string,
  url: string,
  options: MarkdownOptions
): MarkdownChild => {
  if (!SAFE_PROTOCOL.test(url) || !options.onLinkClick) {
    return label || url;
  }
  return h(
    "a",
    {
      class: "release-notes-link",
      href: url,
      title: url,
      onClick: (event: MouseEvent) => {
        event.preventDefault();
        options.onLinkClick?.(url);
      }
    },
    label || url
  );
};

/**
 * 解析行内 Markdown。所有文本都作为 Vue 文本节点输出，
 * 不经过 innerHTML，因此不会执行 release notes 中的 HTML。
 */
const parseInline = (
  text: string,
  options: MarkdownOptions
): MarkdownChild[] => {
  const nodes: MarkdownChild[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (index < text.length) {
    const rest = text.slice(index);

    // 行内代码
    let match = /^`([^`]+)`/.exec(rest);
    if (match) {
      flush();
      nodes.push(h("code", match[1]));
      index += match[0].length;
      continue;
    }

    // 图片：不加载远程图片，降级为指向图片地址的链接
    match = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest);
    if (match) {
      flush();
      nodes.push(createLink(match[1] || match[2], match[2], options));
      index += match[0].length;
      continue;
    }

    // 链接
    match = /^\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest);
    if (match) {
      flush();
      nodes.push(createLink(match[1] || match[2], match[2], options));
      index += match[0].length;
      continue;
    }

    // 加粗
    match = /^(\*\*|__)([\s\S]+?)\1/.exec(rest);
    if (match) {
      flush();
      nodes.push(h("strong", parseInline(match[2], options)));
      index += match[0].length;
      continue;
    }

    // 删除线
    match = /^~~([\s\S]+?)~~/.exec(rest);
    if (match) {
      flush();
      nodes.push(h("del", parseInline(match[1], options)));
      index += match[0].length;
      continue;
    }

    // 斜体（* 不在单词中间）
    match = /^\*([^*\n]+)\*/.exec(rest);
    if (match) {
      flush();
      nodes.push(h("em", parseInline(match[1], options)));
      index += match[0].length;
      continue;
    }

    // 斜体（_ 只在词边界生效，避免拆开 snake_case）
    const prevChar = index > 0 ? text[index - 1] : "";
    if (!/[\w]/.test(prevChar)) {
      match = /^_([^_\n]+)_/.exec(rest);
      if (match) {
        flush();
        nodes.push(h("em", parseInline(match[1], options)));
        index += match[0].length;
        continue;
      }
    }

    // 裸链接
    match = /^https?:\/\/[^\s<>()"]+/.exec(rest);
    if (match) {
      const url = match[0].replace(/[.,;:!?]+$/, "");
      flush();
      nodes.push(createLink(url, url, options));
      index += url.length;
      continue;
    }

    buffer += rest[0];
    index++;
  }

  flush();
  return nodes;
};

const isBlockStart = (line: string) =>
  /^\s*(#{1,6}\s|```|~~~|[-*+]\s+|\d+[.)]\s+|>\s?)/.test(line) ||
  /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);

const renderBlocks = (lines: string[], options: MarkdownOptions): VNode[] => {
  const blocks: VNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index++;
      continue;
    }

    // 代码块
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !/^\s*(```|~~~)/.test(lines[index])) {
        codeLines.push(lines[index]);
        index++;
      }
      index++; // 跳过结束围栏
      blocks.push(h("pre", [h("code", codeLines.join("\n"))]));
      continue;
    }

    // 标题
    const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push(
        h(
          `h${Math.min(heading[1].length, 6)}`,
          parseInline(heading[2], options)
        )
      );
      index++;
      continue;
    }

    // 分隔线
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(h("hr"));
      index++;
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index++;
      }
      blocks.push(h("blockquote", renderBlocks(quoteLines, options)));
      continue;
    }

    // 无序列表
    const unordered = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (unordered) {
      const items: MarkdownChild[][] = [];
      while (index < lines.length) {
        const item = /^\s*[-*+]\s+(.*)$/.exec(lines[index]);
        if (!item) {
          break;
        }
        items.push(parseInline(item[1], options));
        index++;
      }
      blocks.push(
        h(
          "ul",
          items.map(item => h("li", item))
        )
      );
      continue;
    }

    // 有序列表
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      const items: MarkdownChild[][] = [];
      while (index < lines.length) {
        const item = /^\s*\d+[.)]\s+(.*)$/.exec(lines[index]);
        if (!item) {
          break;
        }
        items.push(parseInline(item[1], options));
        index++;
      }
      blocks.push(
        h(
          "ol",
          items.map(item => h("li", item))
        )
      );
      continue;
    }

    // 段落（先消费当前行，避免匹配到未知块语法时死循环）
    const paragraph: string[] = [line.trim()];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index++;
    }
    if (paragraph.length) {
      blocks.push(h("p", parseInline(paragraph.join(" "), options)));
    }
  }

  return blocks;
};

/**
 * 将 GitHub release notes 的 Markdown 渲染为 Vue 节点。
 *
 * 仅支持 release notes 常见语法（标题、列表、链接、代码、强调），
 * 所有内容均以文本节点或受控元素输出，不使用 v-html / dangerouslyUseHTMLString。
 */
export const renderMarkdown = (
  markdown: string,
  options: MarkdownOptions = {}
): VNode[] => {
  if (!markdown) {
    return [];
  }
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  return renderBlocks(lines, options);
};
