const albums = [
  {
    id: "journey",
    title: "Journey",
    artist: "Austin Wintory",
    year: 2012,
    region: "欧美",
    style: "电影/游戏原声",
    coverUrl: "assets/covers/E493418C-7D4C-4114-9475-7DD55918D8D6.webp",
    tracks: ["Nascence", "The Call", "First Confluence", "The Road of Trials", "Final Confluence"]
  },
  {
    id: "memories",
    title: "Memories",
    artist: "刘德华",
    year: 1995,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/6ADC32CE-A7D1-4057-860D-0698CB2CF547.webp",
    tracks: ["情未鸟", "忘情水", "天意", "缠绵", "谢谢你的爱"]
  },
  {
    id: "adele21",
    title: "21",
    artist: "Adele",
    year: 2011,
    region: "欧美",
    style: "其他",
    coverUrl: "assets/covers/71668FBD-4809-4456-BAB3-3FDC5F46DB7E.webp",
    tracks: ["Rolling in the Deep", "Rumour Has It", "Turning Tables", "Set Fire to the Rain", "Someone Like You"]
  },
  {
    id: "request",
    title: "Request",
    artist: "竹内玛莉亚",
    year: 1987,
    region: "日韩",
    style: "日语/City Pop",
    coverUrl: "assets/covers/9A141EAF-92B2-4669-AB3C-BA0260BEFBCE.webp",
    tracks: ["恋の嵐", "Oh No, Oh Yes!", "けんかをやめて", "駅", "元気を出して"]
  },
  {
    id: "wanderer",
    title: "浪人情歌",
    artist: "伍佰 & China Blue",
    year: 1994,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/7DD83F0E-1FAE-4DDD-AF50-C7DF03C52C30.webp",
    tracks: ["浪人情歌", "牵挂", "算了吧", "背叛", "钢铁男子"]
  },
  {
    id: "dove",
    title: "白鸽",
    artist: "伍佰 & China Blue",
    year: 1999,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/7646C668-C7E4-4D96-925A-4B31C2667EAA.webp",
    tracks: ["白鸽", "上瘾了", "真世界", "与你到永久", "终于"]
  },
  {
    id: "double",
    title: "双面人",
    artist: "伍佰 & China Blue",
    year: 2005,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/E87CC2D5-18B1-41A6-BDAA-4AEFA5A7680A.webp",
    tracks: ["双面人", "海浪", "厉害", "风火", "下港人在台北市"]
  },
  {
    id: "live",
    title: "伍佰的Live",
    artist: "伍佰 & China Blue",
    year: 1995,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/ED5E08B3-20CF-4CA1-A18B-E91266A86FC7.webp",
    tracks: ["挪威的森林", "浪人情歌", "爱情限时批", "夏夜晚风", "亲爱的你"]
  },
  {
    id: "ending",
    title: "爱情的尽头",
    artist: "伍佰 & China Blue",
    year: 1996,
    region: "港台/新马",
    style: "华语流行",
    coverUrl: "assets/covers/BD6D4342-14E5-4F9B-A39C-05BD13B4C667.webp",
    tracks: ["爱情的尽头", "挪威的森林", "亲爱的你", "一亲红颜", "继续堕落"]
  }
];

const collectionItems = [
  {
    id: "collection-journey",
    userId: "david",
    albumId: "journey",
    collectionDate: "2024-10-02",
    source: "线上购买",
    quantity: 1,
    condition: "NM",
    mediumKey: "vinyl",
    price: 230,
    notes: "Featured album",
    createdAt: "2024-10-02T10:00:00.000Z",
    updatedAt: "2024-10-02T10:00:00.000Z"
  },
  {
    id: "collection-memories",
    userId: "david",
    albumId: "memories",
    collectionDate: "2025-05-01",
    source: "线上购买",
    quantity: 1,
    condition: "NM",
    mediumKey: "vinyl",
    price: 9700,
    notes: "",
    createdAt: "2025-05-01T10:00:00.000Z",
    updatedAt: "2025-05-01T10:00:00.000Z"
  },
  {
    id: "collection-adele21",
    userId: "david",
    albumId: "adele21",
    collectionDate: "2023-03-14",
    source: "线上购买",
    quantity: 1,
    condition: "NM",
    mediumKey: "cd",
    price: 243,
    notes: "",
    createdAt: "2023-03-14T10:00:00.000Z",
    updatedAt: "2023-03-14T10:00:00.000Z"
  },
  {
    id: "collection-request",
    userId: "david",
    albumId: "request",
    collectionDate: "2025-02-18",
    source: "线上购买",
    quantity: 1,
    condition: "NM",
    mediumKey: "vinyl",
    price: 290,
    notes: "",
    createdAt: "2025-02-18T10:00:00.000Z",
    updatedAt: "2025-02-18T10:00:00.000Z"
  }
];

const tvBindings = [
  {
    id: "tv-living-room",
    userId: "david",
    deviceName: "客厅小米电视",
    deviceCode: "DAVID-TV-01",
    status: "active",
    lastSyncedAt: "2026-07-11T00:00:00.000Z"
  }
];

const demoPricesByAlbumId = {
  journey: 230,
  memories: 9700,
  adele21: 243,
  request: 290,
  wanderer: 1200,
  dove: 650,
  double: 330,
  live: 2200,
  ending: 390
};

module.exports = {
  albums,
  collectionItems,
  tvBindings,
  demoPricesByAlbumId,
  featuredAlbumId: "journey",
  recentAlbumIds: ["memories", "adele21", "request"]
};
