const assert = require("node:assert/strict");
const test = require("node:test");

const {
  addEditableTrack,
  normalizeEditableTracks,
  removeEditableTrack,
  updateEditableTrack,
  uploadAlbumCover
} = require("../services/album-edit-service.js");
const { toAlbumView } = require("../services/album-library-service.js");
const { buildCloudCollectionRequest } = require("../services/cloud-api.js");

test("editable tracks can be added, changed, removed, and normalized", () => {
  const initial = normalizeEditableTracks(["Opening", { position: 4, title: " Finale " }, { title: "" }]);
  assert.deepEqual(initial, [
    { position: 1, title: "Opening" },
    { position: 2, title: "Finale" }
  ]);

  const added = addEditableTrack(initial);
  const changed = updateEditableTrack(added, 2, "Encore");
  const removed = removeEditableTrack(changed, 0);

  assert.deepEqual(normalizeEditableTracks(removed), [
    { position: 1, title: "Finale" },
    { position: 2, title: "Encore" }
  ]);
});

test("local album covers upload to stable cloud storage", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      uploadFile(options) {
        calls.push(options);
        options.success({ fileID: "cloud://prod/album-covers/user-1/album-1/cover.jpg" });
        return { abort() {} };
      }
    }
  };

  const cover = await uploadAlbumCover({
    cover: "wxfile://tmp/selected.jpg",
    albumId: "album-1",
    userId: "user-1",
    wxApi,
    timeoutMs: 50,
    now: 123
  });

  assert.equal(cover, "cloud://prod/album-covers/user-1/album-1/cover.jpg");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filePath, "wxfile://tmp/selected.jpg");
  assert.match(calls[0].cloudPath, /^album-covers\/user-1\/album-1\/123\.jpg$/);
});

test("remote covers do not upload again and stalled uploads time out", async () => {
  let uploadCount = 0;
  const wxApi = {
    cloud: {
      uploadFile() {
        uploadCount += 1;
        return { abort() {} };
      }
    }
  };

  assert.equal(await uploadAlbumCover({ cover: "https://example.com/cover.jpg", wxApi }), "https://example.com/cover.jpg");
  await assert.rejects(
    uploadAlbumCover({
      cover: "wxfile://tmp/stalled.png",
      albumId: "album-1",
      userId: "user-1",
      wxApi,
      timeoutMs: 5
    }),
    /封面上传超时/
  );
  assert.equal(uploadCount, 1);
});

test("a missing release year stays empty in saved data instead of becoming display text", () => {
  const album = toAlbumView({ id: "album-1", title: "KUN", artist: "蔡徐坤", tracks: [] });
  const request = buildCloudCollectionRequest(
    { albumId: "album-1", collectionDate: "2026-07-27", quantity: 1 },
    album
  );

  assert.equal(album.year, undefined);
  assert.equal(request.album.year, null);
});
