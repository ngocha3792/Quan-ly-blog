import sanitizeHtml from 'sanitize-html';

/**
 * Giới hạn HTML của một bài viết.
 *
 * 30.000 ký tự đủ lớn cho một bài blog
 * và vẫn an toàn với request JSON hiện tại.
 */
export const MAX_POST_CONTENT_LENGTH =
  30_000;

/**
 * Làm sạch HTML do Quill gửi lên.
 *
 * Chỉ giữ những tag mà editor hiện tại cần.
 */
export function sanitizePostContent(
  value: unknown,
): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return sanitizeHtml(value, {
    allowedTags: [
      'p',
      'br',

      'h1',
      'h2',
      'h3',

      'strong',
      'b',

      'em',
      'i',

      'u',
      's',

      'blockquote',

      'pre',
      'code',

      'ol',
      'ul',
      'li',

      'span',
      'div',

      'a',

      'img',

      'iframe',
    ],

    allowedAttributes: {
      '*': [
        'class',
      ],

      span: [
        'class',
        'style',
      ],

      li: [
        'class',
        'data-list',
      ],

      div: [
        'class',
        'data-language',
      ],

      a: [
        'href',
        'target',
        'rel',
      ],

      img: [
        'src',
        'alt',
        'title',
        'width',
        'height',
      ],

      iframe: [
        'src',
        'class',
        'frameborder',
        'allowfullscreen',
      ],
    },

    allowedStyles: {
      span: {
        color: [
          /^#[0-9a-f]{3,8}$/i,
          /^rgba?\([^)]+\)$/i,
          /^[a-z]+$/i,
        ],

        'background-color': [
          /^#[0-9a-f]{3,8}$/i,
          /^rgba?\([^)]+\)$/i,
          /^[a-z]+$/i,
        ],
      },
    },

    /**
     * Link thông thường.
     */
    allowedSchemes: [
      'http',
      'https',
      'mailto',
    ],

    allowedSchemesByTag: {
      img: [
        'http',
        'https',
        'data',
      ],

      iframe: [
        'https',
      ],
    },

    /**
     * Video chỉ cho một số host tin cậy.
     */
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'player.vimeo.com',
    ],

    /**
     * script/object/embed...
     * sẽ bị bỏ.
     */
    disallowedTagsMode: 'discard',
  });
}