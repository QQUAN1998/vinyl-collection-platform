ALTER TABLE `collections`
ADD COLUMN `album_override` JSON NULL;

-- Preserve the latest Sammi edit as that collector's private snapshot before
-- restoring the shared catalog row changed by the old global-update behavior.
UPDATE `collections` AS `collection`
INNER JOIN `albums` AS `album` ON `album`.`id` = `collection`.`album_id`
SET `collection`.`album_override` = JSON_OBJECT(
  'id', `album`.`id`,
  'title', `album`.`title`,
  'artist', `album`.`artist`,
  'year', `album`.`release_year`,
  'region', NULL,
  'style', `album`.`genre`,
  'coverUrl', `album`.`cover_url`,
  'tracks', COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT('position', `track`.`position`, 'title', `track`.`title`)
      )
      FROM `album_tracks` AS `track`
      WHERE `track`.`album_id` = `album`.`id`
    ),
    JSON_ARRAY()
  )
)
WHERE `collection`.`id` = (
  SELECT `latest`.`id`
  FROM (
    SELECT `candidate`.`id`
    FROM `collections` AS `candidate`
    WHERE `candidate`.`album_id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
    ORDER BY `candidate`.`updated_at` DESC
    LIMIT 1
  ) AS `latest`
);

UPDATE `albums`
SET
  `title` = 'Sammi初',
  `artist` = '郑秀文',
  `release_year` = 2026,
  `genre` = '黑胶',
  `cover_url` = 'https://vinyl-prod-d0g8u61k95ee7a1e6-1314675814.tcloudbaseapp.com/easter/v1/covers/easter-0385.jpg'
WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83';

DELETE FROM `album_tracks`
WHERE `album_id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83';

INSERT INTO `album_tracks` (`id`, `album_id`, `position`, `title`)
SELECT 'repair-sammi-01', `id`, 1, '不来的季节 (Remastered 2026)' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-02', `id`, 2, '思念' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-03', `id`, 3, '娃娃看天下' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-04', `id`, 4, '时间,地点,人物' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-05', `id`, 5, '萨拉热窝的罗密欧与茱丽叶' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-06', `id`, 6, 'Chotto等等 (Remastered 2026)' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-07', `id`, 7, '叮当' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-08', `id`, 8, '十诫' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-09', `id`, 9, '热爱岛' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-10', `id`, 10, '冲动点唱' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83'
UNION ALL SELECT 'repair-sammi-11', `id`, 11, 'Friends' FROM `albums` WHERE `id` = 'easter-f6695a64-637f-4b02-bc31-641e6b068e83';
