const { findAlbumInLibrary } = require("./album-library-service.js");

function buildCollectionMarkdown(options = {}) {
  const ownerName = options.ownerName || "\u5531\u7247\u67dc\u7528\u6237";
  const now = options.now || new Date();
  const albums = options.albums || [];
  const manualAlbums = options.manualAlbums || [];
  const collectionItems = options.collectionItems || [];
  const lines = [
    `# ${ownerName} \u7684\u5531\u7247\u67dc`,
    "",
    `\u5bfc\u51fa\u65f6\u95f4\uff1a${formatDateTime(now)}`,
    `\u5171 ${collectionItems.length} \u5f20\u5531\u7247`,
    "",
    "## \u6536\u85cf\u6e05\u5355",
    ""
  ];

  if (!collectionItems.length) {
    lines.push("\u6682\u65e0\u6536\u85cf\u5531\u7247\u3002");
    return lines.join("\n");
  }

  collectionItems.forEach((item, index) => {
    const album = findAlbumInLibrary(item.albumId, albums, manualAlbums) || {};
    const title = album.title || item.albumId || "\u672a\u77e5\u4e13\u8f91";
    const artist = album.artist || "\u672a\u77e5\u827a\u4eba";
    lines.push(`${index + 1}. **${title}** - ${artist}`);
    lines.push(`   - \u5e74\u4efd\uff1a${album.year || "\u672a\u8bb0\u5f55"}`);
    lines.push(`   - \u98ce\u683c\uff1a${album.style || album.genre || "\u672a\u5206\u7c7b"}`);
    lines.push(`   - \u6536\u85cf\u65e5\u671f\uff1a${item.collectionDate || "\u672a\u8bb0\u5f55"}`);
    lines.push(`   - \u4ecb\u8d28\uff1a${item.mediumKey || "vinyl"}`);
    if (item.price !== undefined && item.price !== "") {
      lines.push(`   - \u4ef7\u683c\uff1a\u00a5${Number(item.price || 0).toLocaleString("zh-CN")}`);
    }
    if (item.notes) {
      lines.push(`   - \u5907\u6ce8\uff1a${item.notes}`);
    }
    lines.push("");
  });

  lines.push("---");
  lines.push("\u6765\u81ea\u5531\u7247\u67dc\u5c0f\u7a0b\u5e8f");
  return lines.join("\n");
}

function exportCollectionMarkdownFile(options = {}, wxApi) {
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!api || typeof api.getFileSystemManager !== "function") {
    return Promise.reject(new Error("WeChat file system is not available."));
  }

  const markdown = buildCollectionMarkdown(options);
  const fileName = buildMarkdownFileName(options.now || new Date());
  const userPath = api.env && api.env.USER_DATA_PATH ? api.env.USER_DATA_PATH : "";
  const filePath = `${userPath}/${fileName}`;
  const fs = api.getFileSystemManager();

  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: markdown,
      encoding: "utf8",
      success() {
        resolve({ filePath, fileName, markdown });
      },
      fail(error) {
        reject(error || new Error("Failed to write markdown file."));
      }
    });
  });
}

function shareMarkdownFile(file, wxApi) {
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!api || !file || !file.filePath) {
    return Promise.reject(new Error("Markdown file is not available."));
  }

  if (typeof api.shareFileMessage === "function") {
    return new Promise((resolve, reject) => {
      api.shareFileMessage({
        filePath: file.filePath,
        fileName: file.fileName,
        success: resolve,
        fail: reject
      });
    });
  }

  if (typeof api.openDocument === "function") {
    return new Promise((resolve, reject) => {
      api.openDocument({
        filePath: file.filePath,
        fileType: "md",
        success: resolve,
        fail: reject
      });
    });
  }

  return Promise.resolve(file);
}

function buildMarkdownFileName(now = new Date()) {
  return `\u5531\u7247\u67dc\u6536\u85cf-${toDate(now)}.md`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${toDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

module.exports = {
  buildCollectionMarkdown,
  buildMarkdownFileName,
  exportCollectionMarkdownFile,
  shareMarkdownFile
};
