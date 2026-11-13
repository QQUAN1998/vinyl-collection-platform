function openImage(url, api = wx) {
  if (typeof url !== 'string' || !url.trim()) return;
  url = url.trim();
  api.showActionSheet({
    itemList: ['查看大图', '保存到相册'],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) api.previewImage({ urls: [url], current: url, showmenu: true });
      if (tapIndex === 1) saveImage(url, api);
    },
  });
}

async function saveImage(url, api = wx) {
  if (typeof url !== 'string' || !url.trim()) return;
  url = url.trim();
  const call = (method, options) => new Promise((resolve, reject) => {
    if (!method) return reject(new Error('当前微信版本暂不支持'));
    method({ ...options, success: resolve, fail: reject });
  });
  const invoke = (name, options) => call(api[name]?.bind(api), options);
  api.showLoading({ title: '正在保存', mask: true });
  try {
    let filePath = url;
    if (/^cloud:\/\//i.test(url)) {
      const file = await call(api.cloud?.downloadFile?.bind(api.cloud), { fileID: url });
      filePath = file.tempFilePath;
    } else if (/^https?:\/\/(?:usr|tmp)\//i.test(url)) {
      filePath = url;
    } else if (/^https?:\/\//i.test(url)) {
      const file = await invoke('downloadFile', { url });
      if (file.statusCode !== 200 || !file.tempFilePath) throw new Error('图片下载失败');
      filePath = file.tempFilePath;
    } else if (!/^(?:wxfile:\/\/|https?:\/\/usr\/|\/|[a-z]:\\)/i.test(url)) {
      throw new Error('图片地址无效');
    }
    if (!filePath) throw new Error('图片下载失败');
    await invoke('saveImageToPhotosAlbum', { filePath });
    api.hideLoading();
    api.showToast({ title: '已保存到相册', icon: 'success' });
  } catch (error) {
    api.hideLoading();
    if (/auth deny|auth denied|authorize|permission|access denied/i.test(error?.errMsg || '')) {
      api.showModal({
        title: '允许保存图片', content: '请在设置中允许保存到相册，然后再次点击保存。', confirmText: '去设置',
        success: result => { if (result.confirm) api.openSetting({}); },
      });
    } else {
      api.showToast({ title: '图片保存失败，请重试', icon: 'none' });
    }
  }
}
module.exports = { openImage, saveImage };
