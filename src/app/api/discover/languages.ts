/**
 * Language-specific engines that work better for certain languages
 */
export const LANGUAGE_SPECIFIC_ENGINES: Record<string, string[]> = {
  // Chinese languages
  'zh': ['bing news', 'brave news', 'duckduckgo news'], 
  'zh-CN': ['bing news', 'brave news', 'duckduckgo news'], 
  'zh-TW': ['bing news', 'brave news', 'duckduckgo news'], 
  'zh_Hans': ['bing news', 'brave news', 'duckduckgo news'], 
  'zh_Hant': ['bing news', 'brave news', 'duckduckgo news'], 

  // European languages
  'it': ['bing news', 'brave news', 'reuters'],
  'fr': ['bing news', 'brave news', 'reuters'],
  'de': ['bing news', 'brave news', 'reuters'],
  'es': ['bing news', 'brave news', 'reuters'],
  'pt': ['bing news', 'brave news', 'reuters'],
  'pt-BR': ['bing news', 'brave news', 'reuters'],

  // Asian languages
  'ru': ['bing news', 'brave news', 'reuters'],
  'ko': ['bing news', 'naver', 'brave news'],
  'ja': ['bing news', 'brave news', 'yahoo japan'],
  'hi': ['bing news', 'brave news', 'duckduckgo news'],

  // Middle Eastern languages
  'ar': ['bing news', 'brave news', 'reuters']
};

/**
 * Language-specific sources and keywords for better results in non-English languages
 */
export const LANGUAGE_SPECIFIC_SOURCES: Record<string, Record<string, { site: string; keyword: string }[]>> = {
  // English sources are provided in categories.ts as DEFAULT_CATEGORIES
  'en': {},

  // Chinese sources (Simplified) - zh / zh-CN / zh_Hans
  'zh': {
    'Technology': [
      { site: 'cnbeta.com', keyword: '科技' },
      { site: 'sspai.com', keyword: '科技' },
      { site: '36kr.com', keyword: '科技' },
      { site: 'ifanr.com', keyword: '科技' },
      { site: 'geekpark.net', keyword: '科技' }
    ],
    'AI': [
      { site: 'jiqizhixin.com', keyword: '人工智能' },
      { site: 'leiphone.com', keyword: '人工智能' },
      { site: 'syncedreview.com', keyword: '人工智能' },
      { site: 'sspai.com', keyword: '人工智能' },
      { site: '36kr.com', keyword: '人工智能' }
    ],
    'Current News': [
      { site: 'thepaper.cn', keyword: '新闻' },
      { site: 'sina.com.cn', keyword: '新闻' },
      { site: 'qq.com', keyword: '新闻' },
      { site: '163.com', keyword: '新闻' },
      { site: 'cctv.com', keyword: '新闻' }
    ],
    'Sports': [
      { site: 'sports.sina.com.cn', keyword: '体育' },
      { site: 'sports.qq.com', keyword: '体育' },
      { site: 'sports.sohu.com', keyword: '体育' },
      { site: 'sports.163.com', keyword: '体育' },
      { site: 'zhibo8.cc', keyword: '体育' }
    ],
    'Money': [
      { site: 'finance.sina.com.cn', keyword: '财经' },
      { site: 'money.163.com', keyword: '财经' },
      { site: 'finance.qq.com', keyword: '金融' },
      { site: 'xueqiu.com', keyword: '投资' },
      { site: 'eastmoney.com', keyword: '财经' }
    ],
    'Gaming': [
      { site: 'gamersky.com', keyword: '游戏' },
      { site: '3dmgame.com', keyword: '游戏' },
      { site: 'tgbus.com', keyword: '游戏' },
      { site: 'game.163.com', keyword: '游戏' },
      { site: 'nga.cn', keyword: '游戏' }
    ],
    'Entertainment': [
      { site: 'ent.sina.com.cn', keyword: '娱乐' },
      { site: 'ent.qq.com', keyword: '娱乐' },
      { site: 'ent.163.com', keyword: '娱乐' },
      { site: 'mtime.com', keyword: '电影' },
      { site: 'douban.com', keyword: '娱乐' }
    ],
    'Art and Culture': [
      { site: 'cafa.com.cn', keyword: '艺术' },
      { site: 'artron.net', keyword: '艺术' },
      { site: 'douban.com', keyword: '文化' },
      { site: 'thepaper.cn', keyword: '文化' },
      { site: 'dpm.org.cn', keyword: '文化' }
    ],
    'Science': [
      { site: 'guokr.com', keyword: '科学' },
      { site: 'science.china.com.cn', keyword: '科学' },
      { site: 'cas.cn', keyword: '科学' },
      { site: 'pansci.asia', keyword: '科学' },
      { site: 'stdaily.com', keyword: '科技日报' } // Added 'stdaily.com' as Scientific American has regional versions
    ],
    'Health': [
      { site: 'dxy.cn', keyword: '健康' },
      { site: 'jk.familydoctor.com.cn', keyword: '健康' },
      { site: 'health.sina.com.cn', keyword: '健康' },
      { site: 'health.people.com.cn', keyword: '健康' },
      { site: 'youlai.cn', keyword: '医疗' }
    ],
    'Travel': [
      { site: 'mafengwo.cn', keyword: '旅游' },
      { site: 'ctrip.com', keyword: '旅游' },
      { site: 'qyer.com', keyword: '旅游' },
      { site: 'lvmama.com', keyword: '旅游' },
      { site: 'tuniu.com', keyword: '旅游' }
    ]
  },

  // Chinese sources (Traditional) - zh-TW / zh_Hant
  'zh-TW': {
    'Technology': [
      { site: 'ithome.com.tw', keyword: '科技' },
      { site: 'techbang.com', keyword: '科技' },
      { site: 'inside.com.tw', keyword: '科技' },
      { site: 'cool3c.com', keyword: '科技' },
      { site: 'bnext.com.tw', keyword: '科技' }
    ],
    'AI': [
      { site: 'inside.com.tw', keyword: '人工智慧' },
      { site: 'ithome.com.tw', keyword: '人工智慧' },
      { site: 'techbang.com', keyword: '人工智慧' },
      { site: 'bnext.com.tw', keyword: '人工智慧' },
      { site: 'technews.tw', keyword: '人工智慧' }
    ],
    'Current News': [
      { site: 'udn.com', keyword: '新聞' },
      { site: 'ltn.com.tw', keyword: '新聞' },
      { site: 'chinatimes.com', keyword: '新聞' },
      { site: 'setn.com', keyword: '新聞' },
      { site: 'ettoday.net', keyword: '新聞' }
    ],
    'Sports': [
      { site: 'nownews.com', keyword: '體育' },
      { site: 'ettoday.net', keyword: '體育' },
      { site: 'ltn.com.tw', keyword: '體育' },
      { site: 'udn.com', keyword: '體育' },
      { site: 'tsna.com.tw', keyword: '體育' }
    ],
    'Money': [
      { site: 'money.udn.com', keyword: '財經' },
      { site: 'cnyes.com', keyword: '財經' },
      { site: 'moneydj.com', keyword: '金融' },
      { site: 'wealth.com.tw', keyword: '財經' },
      { site: 'ctee.com.tw', keyword: '財經' }
    ],
    'Gaming': [
      { site: 'gamer.com.tw', keyword: '遊戲' },
      { site: 'gamebase.com.tw', keyword: '遊戲' },
      { site: '4gamers.com.tw', keyword: '遊戲' },
      { site: 'gamme.com.tw', keyword: '遊戲' },
      { site: 'upmedia.mg', keyword: '遊戲' }
    ],
    'Entertainment': [
      { site: 'ettoday.net', keyword: '娛樂' },
      { site: 'chinatimes.com', keyword: '娛樂' },
      { site: 'udn.com', keyword: '娛樂' },
      { site: 'ltn.com.tw', keyword: '娛樂' },
      { site: 'setn.com', keyword: '娛樂' }
    ],
    'Art and Culture': [ // Added Art and Culture for zh-TW
      { site: 'artouch.com', keyword: '藝術' },
      { site: 'culture.teldap.tw', keyword: '文化' },
      { site: 'npac-ntch.org', keyword: '藝術文化' }, // National Theater & Concert Hall
      { site: 'moc.gov.tw', keyword: '文化' }, // Ministry of Culture
      { site: 'taishinart.org.tw', keyword: '藝術' } // Taishin Bank Foundation for Arts and Culture
    ],
    'Science': [
      { site: 'pansci.asia', keyword: '科學' },
      { site: 'technews.tw', keyword: '科學' },
      { site: 'cna.com.tw', keyword: '科學' },
      { site: 'nstc.gov.tw', keyword: '科學' }, // National Science and Technology Council
      { site: 'sinica.edu.tw', keyword: '科學' } // Academia Sinica
    ],
    'Health': [
      { site: 'health.udn.com', keyword: '健康' },
      { site: 'commonhealth.com.tw', keyword: '健康' },
      { site: 'top1health.com', keyword: '健康' },
      { site: 'heho.com.tw', keyword: '健康' },
      { site: 'healthnews.com.tw', keyword: '健康' }
    ],
    'Travel': [
      { site: 'mook.com.tw', keyword: '旅遊' },
      { site: 'lifetour.com.tw', keyword: '旅遊' },
      { site: 'travel.ettoday.net', keyword: '旅遊' },
      { site: 'udn.com/news/cate/2/7193', keyword: '旅遊' }, // Corrected UDN travel path
      { site: 'funtime.com.tw', keyword: '旅遊' } // Replaced fun-taiwan with funtime
    ]
  },

  // Italian sources - it
  'it': {
    'Technology': [
      { site: 'wired.it', keyword: 'tecnologia' },
      { site: 'hdblog.it', keyword: 'tech' },
      { site: 'tomshw.it', keyword: 'tecnologia' },
      { site: 'hwupgrade.it', keyword: 'tech' },
      { site: 'dday.it', keyword: 'tecnologia' }
    ],
    'AI': [
      { site: 'ai4business.it', keyword: 'intelligenza artificiale' },
      { site: 'wired.it', keyword: 'intelligenza artificiale' },
      { site: 'agendadigitale.eu', keyword: 'intelligenza artificiale' },
      { site: 'hdblog.it', keyword: 'intelligenza artificiale' },
      { site: 'ansa.it', keyword: 'intelligenza artificiale' }
    ],
    'Current News': [
      { site: 'repubblica.it', keyword: 'notizie' },
      { site: 'corriere.it', keyword: 'notizie' },
      { site: 'ansa.it', keyword: 'notizie' },
      { site: 'lastampa.it', keyword: 'news' },
      { site: 'ilsole24ore.com', keyword: 'notizie' }
    ],
    'Sports': [
      { site: 'gazzetta.it', keyword: 'sport' },
      { site: 'sport.sky.it', keyword: 'sport' },
      { site: 'corrieredellosport.it', keyword: 'sport' },
      { site: 'tuttosport.com', keyword: 'sport' },
      { site: 'sportmediaset.mediaset.it', keyword: 'sport' }
    ],
    'Money': [
      { site: 'ilsole24ore.com', keyword: 'finanza' },
      { site: 'borsaitaliana.it', keyword: 'finanza' },
      { site: 'milanofinanza.it', keyword: 'finanza' },
      { site: 'soldionline.it', keyword: 'finanza' },
      { site: 'quifinanza.it', keyword: 'economia' }
    ],
    'Gaming': [
      { site: 'multiplayer.it', keyword: 'videogiochi' },
      { site: 'eurogamer.it', keyword: 'videogiochi' },
      { site: 'everyeye.it', keyword: 'videogiochi' },
      { site: 'ign.com/it', keyword: 'videogiochi' },
      { site: 'spaziogames.it', keyword: 'videogiochi' }
    ],
    'Entertainment': [
      { site: 'comingsoon.it', keyword: 'intrattenimento' },
      { site: 'movieplayer.it', keyword: 'intrattenimento' },
      { site: 'badtaste.it', keyword: 'cinema' },
      { site: 'ansa.it/sito/notizie/cultura/cinema', keyword: 'cinema' },
      { site: 'rockol.it', keyword: 'musica' }
    ],
    'Art and Culture': [
      { site: 'arte.it', keyword: 'arte' },
      { site: 'artribune.com', keyword: 'arte' },
      { site: 'finestresullarte.info', keyword: 'arte' },
      { site: 'exibart.com', keyword: 'arte' },
      { site: 'illibraio.it', keyword: 'cultura' }
    ],
    'Science': [
      { site: 'focus.it', keyword: 'scienza' },
      { site: 'lescienze.it', keyword: 'scienza' },
      { site: 'galileonet.it', keyword: 'scienza' },
      { site: 'nationalgeographic.it', keyword: 'scienza' },
      { site: 'oggiscienza.it', keyword: 'scienza' }
    ],
    'Health': [
      { site: 'corriere.it/salute', keyword: 'salute' },
      { site: 'repubblica.it/salute', keyword: 'salute' },
      { site: 'tg24.sky.it/salute-e-benessere', keyword: 'salute' },
      { site: 'fondazioneveronesi.it', keyword: 'salute' },
      { site: 'humanitas.it', keyword: 'salute' }
    ],
    'Travel': [
      { site: 'viaggi.corriere.it', keyword: 'viaggi' },
      { site: 'viaggi.repubblica.it', keyword: 'viaggi' },
      { site: 'turismo.it', keyword: 'viaggi' },
      { site: 'siviaggia.it', keyword: 'viaggi' },
      { site: 'viaggi.lastampa.it', keyword: 'viaggi' }
    ]
  },

  // Arabic sources - ar
  'ar': {
    'Technology': [
      { site: 'aitnews.com', keyword: 'تكنولوجيا' },
      { site: 'tech-wd.com', keyword: 'تقنية' },
      { site: 'arageek.com', keyword: 'تكنولوجيا' },
      { site: 'arabnet.me', keyword: 'تقنية' },
      { site: 'aljazeera.net', keyword: 'تكنولوجيا' }
    ],
    'AI': [
      { site: 'aitnews.com', keyword: 'الذكاء الاصطناعي' },
      { site: 'arageek.com', keyword: 'الذكاء الاصطناعي' },
      { site: 'arabnet.me', keyword: 'الذكاء الاصطناعي' },
      { site: 'aljazeera.net', keyword: 'الذكاء الاصطناعي' },
      { site: 'bbc.com/arabic', keyword: 'الذكاء الاصطناعي' }
    ],
    'Current News': [
      { site: 'aljazeera.net', keyword: 'أخبار' },
      { site: 'bbc.com/arabic', keyword: 'أخبار' },
      { site: 'skynewsarabia.com', keyword: 'أخبار' },
      { site: 'alarabiya.net', keyword: 'أخبار' },
      { site: 'cnbcarabia.com', keyword: 'أخبار' }
    ],
    'Sports': [
      { site: 'kooora.com', keyword: 'رياضة' },
      { site: 'yallakora.com', keyword: 'رياضة' },
      { site: 'filgoal.com', keyword: 'كرة القدم' },
      { site: 'beinsports.com/ar', keyword: 'رياضة' },
      { site: 'alarabiya.net/sport', keyword: 'رياضة' }
    ],
    'Money': [
      { site: 'cnbcarabia.com', keyword: 'اقتصاد' },
      { site: 'aleqt.com', keyword: 'اقتصاد' },
      { site: 'alarabiya.net/aswaq', keyword: 'اقتصاد' },
      { site: 'aljazeera.net/ebusiness', keyword: 'اقتصاد' },
      { site: 'mubasher.info', keyword: 'مال' }
    ],
    'Gaming': [
      { site: 'arageek.com', keyword: 'ألعاب' },
      { site: 'eg.ign.com', keyword: 'ألعاب فيديو' },
      { site: 'arabhardware.net/category/gaming', keyword: 'ألعاب' }, // Changed arabnet5 to arabhardware
      { site: 'vga4a.com', keyword: 'ألعاب' },
      { site: 'saudigamer.com', keyword: 'ألعاب' } // Changed tech-wd to saudigamer
    ],
    'Entertainment': [
      { site: 'layalina.com', keyword: 'ترفيه' }, // Changed fann.com
      { site: 'filfan.com', keyword: 'ترفيه' },
      { site: 'elcinema.com', keyword: 'سينما' },
      { site: 'etbilarabi.com', keyword: 'فن' }, // Changed alarabiya
      { site: 'sayidaty.net/categories/art-and-entertainment', keyword: 'فن' } // Changed assahifa
    ],
    'Art and Culture': [
      { site: 'culture.aljazeera.net', keyword: 'ثقافة' },
      { site: 'alaraby.co.uk/culture', keyword: 'ثقافة' },
      { site: 'al-fanarmedia.org/ar', keyword: 'فن' },
      { site: 'arageek.com/art', keyword: 'فن' },
      { site: 'alarabiya.net/culture-and-art', keyword: 'ثقافة' } // Changed albawabhnews
    ],
    'Science': [
      { site: 'aljazeera.net/science', keyword: 'علوم' },
      { site: 'noonpost.com', keyword: 'علوم' },
      { site: 'scientificamerican.com/arabic', keyword: 'علوم' },
      { site: 'bbc.com/arabic/scienceandtech', keyword: 'علوم' },
      { site: 'nasainarabic.net', keyword: 'علوم' } // Changed albawabhnews
    ],
    'Health': [
      { site: 'altibbi.com', keyword: 'صحة' },
      { site: 'webteb.com', keyword: 'صحة' },
      { site: 'sehatok.com', keyword: 'صحة' }, // Changed sehati.gov.sa
      { site: 'aljazeera.net/health', keyword: 'صحة' }, // Changed moh.gov.sa
      { site: 'dailymedicalinfo.com', keyword: 'صحة' }
    ],
    'Travel': [
      { site: 'almosafer.com', keyword: 'سفر' },
      { site: 'arabiantraveler.com', keyword: 'سياحة' },
      { site: 'sayidaty.net/categories/travel', keyword: 'سفر' }, // Changed jeeran
      { site: 'saffar.blog', keyword: 'سفر' },
      { site: 'aljazeera.net/travel', keyword: 'سياحة' }
    ]
  },

  // French sources - fr
  'fr': {
    'Technology': [
      { site: '01net.com', keyword: 'technologie' },
      { site: 'lesnumeriques.com', keyword: 'tech' },
      { site: 'frandroid.com', keyword: 'technologie' },
      { site: 'clubic.com', keyword: 'tech' },
      { site: 'numerama.com', keyword: 'technologie' }
    ],
    'AI': [
      { site: 'usine-digitale.fr', keyword: 'intelligence artificielle' },
      { site: 'lemonde.fr', keyword: 'intelligence artificielle' },
      { site: 'lebigdata.fr', keyword: 'intelligence artificielle' },
      { site: 'sciencesetavenir.fr', keyword: 'intelligence artificielle' },
      { site: 'actuia.com', keyword: 'intelligence artificielle' } // Changed larecherche
    ],
    'Current News': [
      { site: 'lemonde.fr', keyword: 'actualité' },
      { site: 'lefigaro.fr', keyword: 'actualité' },
      { site: 'liberation.fr', keyword: 'actualité' },
      { site: 'francetvinfo.fr', keyword: 'info' },
      { site: 'leparisien.fr', keyword: 'actualité' }
    ],
    'Sports': [
      { site: 'lequipe.fr', keyword: 'sport' },
      { site: 'sports.fr', keyword: 'sport' },
      { site: 'eurosport.fr', keyword: 'sport' },
      { site: 'rmcsport.bfmtv.com', keyword: 'sport' },
      { site: 'ouest-france.fr/sport', keyword: 'sport' } // Changed francefootball
    ],
    'Money': [
      { site: 'capital.fr', keyword: 'économie' },
      { site: 'lesechos.fr', keyword: 'finance' },
      { site: 'latribune.fr', keyword: 'économie' },
      { site: 'boursorama.com', keyword: 'finance' },
      { site: 'challenges.fr', keyword: 'économie' }
    ],
    'Gaming': [
      { site: 'jeuxvideo.com', keyword: 'jeux vidéo' },
      { site: 'gamekult.com', keyword: 'jeux vidéo' },
      { site: 'jvn.com', keyword: 'jeux vidéo' },
      { site: 'gamergen.com', keyword: 'jeux vidéo' },
      { site: 'millenium.org', keyword: 'jeux vidéo' }
    ],
    'Entertainment': [
      { site: 'allocine.fr', keyword: 'cinéma' },
      { site: 'telerama.fr', keyword: 'culture' },
      { site: 'premiere.fr', keyword: 'cinéma' },
      { site: 'purepeople.com', keyword: 'célébrités' },
      { site: 'gala.fr', keyword: 'célébrités' }
    ],
    'Art and Culture': [
      { site: 'beauxarts.com', keyword: 'art' }, // Changed beaux-arts.fr
      { site: 'connaissancedesarts.com', keyword: 'art' },
      { site: 'arts-in-the-city.com', keyword: 'art' },
      { site: 'lejournaldesarts.fr', keyword: 'art' }, // Changed exponaute
      { site: 'sortiraparis.com/arts-culture', keyword: 'culture' } // Changed artcurial
    ],
    'Science': [
      { site: 'futura-sciences.com', keyword: 'science' },
      { site: 'sciencesetavenir.fr', keyword: 'science' },
      { site: 'pourlascience.fr', keyword: 'science' },
      { site: 'cnrs.fr', keyword: 'science' },
      { site: 'lejournal.cnrs.fr', keyword: 'science' }
    ],
    'Health': [
      { site: 'doctissimo.fr', keyword: 'santé' },
      { site: 'passeportsante.net', keyword: 'santé' },
      { site: 'pourquoidocteur.fr', keyword: 'santé' },
      { site: 'topsante.com', keyword: 'santé' },
      { site: 'santemagazine.fr', keyword: 'santé' }
    ],
    'Travel': [
      { site: 'routard.com', keyword: 'voyage' },
      { site: 'geo.fr', keyword: 'voyage' },
      { site: 'lonelyplanet.fr', keyword: 'voyage' },
      { site: 'voyages.michelin.fr', keyword: 'voyage' },
      { site: 'nationalgeographic.fr', keyword: 'voyage' }
    ]
  },

  // German sources - de
  'de': {
    'Technology': [
      { site: 'heise.de', keyword: 'technologie' },
      { site: 'chip.de', keyword: 'tech' },
      { site: 'computerbild.de', keyword: 'technik' },
      { site: 'golem.de', keyword: 'tech' },
      { site: 't3n.de', keyword: 'technologie' }
    ],
    'AI': [
      { site: 'heise.de', keyword: 'künstliche intelligenz' },
      { site: 'ki-business.de', keyword: 'künstliche intelligenz' },
      { site: 'faz.net', keyword: 'künstliche intelligenz' },
      { site: 'zeit.de', keyword: 'künstliche intelligenz' },
      { site: 'spektrum.de', keyword: 'künstliche intelligenz' }
    ],
    'Current News': [
      { site: 'spiegel.de', keyword: 'nachrichten' },
      { site: 'faz.net', keyword: 'nachrichten' },
      { site: 'zeit.de', keyword: 'nachrichten' },
      { site: 'sueddeutsche.de', keyword: 'nachrichten' },
      { site: 'tagesschau.de', keyword: 'nachrichten' }
    ],
    'Sports': [
      { site: 'kicker.de', keyword: 'sport' },
      { site: 'sport1.de', keyword: 'sport' },
      { site: 'sportschau.de', keyword: 'sport' },
      { site: 'spox.com', keyword: 'sport' },
      { site: 'ran.de', keyword: 'sport' }
    ],
    'Money': [
      { site: 'handelsblatt.com', keyword: 'wirtschaft' },
      { site: 'finanzen.net', keyword: 'finanzen' },
      { site: 'manager-magazin.de', keyword: 'wirtschaft' },
      { site: 'wiwo.de', keyword: 'wirtschaft' },
      { site: 'boerse-online.de', keyword: 'finanzen' }
    ],
    'Gaming': [
      { site: 'gamestar.de', keyword: 'spiele' },
      { site: 'pcgames.de', keyword: 'spiele' },
      { site: 'gamepro.de', keyword: 'spiele' },
      { site: '4players.de', keyword: 'spiele' },
      { site: 'playnation.de', keyword: 'spiele' }
    ],
    'Entertainment': [
      { site: 'filmstarts.de', keyword: 'unterhaltung' },
      { site: 'moviepilot.de', keyword: 'filme' },
      { site: 'bild.de/unterhaltung', keyword: 'unterhaltung' },
      { site: 'stern.de/kultur', keyword: 'unterhaltung' },
      { site: 'rtl.de', keyword: 'unterhaltung' }
    ],
    'Art and Culture': [
      { site: 'kultur.zeit.de', keyword: 'kultur' },
      { site: 'sueddeutsche.de/kultur', keyword: 'kunst' },
      { site: 'artnet.de', keyword: 'kunst' },
      { site: 'monopol-magazin.de', keyword: 'kunst' },
      { site: 'faz.net/aktuell/feuilleton', keyword: 'kultur' }
    ],
    'Science': [ // Completed German Science
      { site: 'spektrum.de', keyword: 'wissenschaft' },
      { site: 'nationalgeographic.de', keyword: 'wissenschaft' },
      { site: 'geo.de/wissen', keyword: 'wissenschaft' },
      { site: 'wissenschaft.de', keyword: 'wissenschaft' },
      { site: 'weltderphysik.de', keyword: 'wissenschaft' }
    ],
    'Health': [ // Added German Health
      { site: 'apotheken-umschau.de', keyword: 'gesundheit' },
      { site: 'netdoktor.de', keyword: 'gesundheit' },
      { site: 'gesundheitsinformation.de', keyword: 'gesundheit' },
      { site: 'minimed.at', keyword: 'gesundheit' }, // Austrian but widely read
      { site: 'aerzteblatt.de', keyword: 'gesundheit' }
    ],
    'Travel': [ // Added German Travel
      { site: 'reisereporter.de', keyword: 'reisen' },
      { site: 'adac.de/reise-freizeit/reiseplanung', keyword: 'reisen' },
      { site: 'geo.de/reisen', keyword: 'reisen' },
      { site: 'merian.de', keyword: 'reisen' },
      { site: 'travelbook.de', keyword: 'reisen' }
    ]
  },

  // Hindi sources - hi
  'hi': {
    'Technology': [
      { site: 'navbharattimes.indiatimes.com/tech/articlelist/2278716.cms', keyword: 'टेक' },
      { site: 'livehindustan.com/gadgets', keyword: 'टेक्नोलॉजी' },
      { site: 'jagran.com/technology', keyword: 'प्रौद्योगिकी' },
      { site: 'amarujala.com/technology', keyword: 'टेक' },
      { site: 'gizbot.com/hindi', keyword: 'टेक समाचार' }
    ],
    'AI': [
      { site: 'navbharattimes.indiatimes.com/tech/articlelist/2278716.cms', keyword: 'एआई' },
      { site: 'livehindustan.com/gadgets', keyword: 'आर्टिफिशियल इंटेलिजेंस' },
      { site: 'jagran.com/technology', keyword: 'एआई' },
      { site: 'bbc.com/hindi/topics/c404v08pzv5t', keyword: 'आर्टिफिशियल इंटेलिजेंस' },
      { site: 'aajtak.in/technology/tech-news', keyword: 'एआई समाचार' }
    ],
    'Current News': [
      { site: 'jagran.com', keyword: 'समाचार' },
      { site: 'bhaskar.com', keyword: 'खबरें' },
      { site: 'amarujala.com', keyword: 'समाचार' },
      { site: 'navbharattimes.indiatimes.com', keyword: 'ताज़ा खबर' },
      { site: 'livehindustan.com', keyword: 'समाचार' }
    ],
    'Sports': [
      { site: 'navbharattimes.indiatimes.com/sports/articlelist/2278833.cms', keyword: 'खेल' },
      { site: 'sportskeeda.com/hindi', keyword: 'खेल समाचार' },
      { site: 'aajtak.in/sports', keyword: 'खेल' },
      { site: 'jagran.com/sports', keyword: 'खेल समाचार' },
      { site: 'livehindustan.com/sports', keyword: 'खेल' }
    ],
    'Money': [
      { site: 'moneycontrol.com/hindi', keyword: 'व्यापार' },
      { site: 'economictimes.indiatimes.com/hindi', keyword: 'अर्थव्यवस्था' },
      { site: 'business-standard.com/hindi', keyword: 'वित्त' },
      { site: 'livemint.com/hindi', keyword: 'बाजार' },
      { site: 'zeebiz.com/hindi', keyword: 'बिज़नेस' }
    ],
    'Gaming': [
      { site: 'sportskeeda.com/esports-and-gaming/hindi', keyword: 'गेमिंग' },
      { site: 'afkgaming.com/hindi', keyword: 'ई-स्पोर्ट्स' },
      { site: 'digit.in/hi/gaming', keyword: 'गेमिंग समाचार' },
      { site: 'thequint.com/hindi/tech-and-auto/games', keyword: 'गेम्स' },
      { site: 'livehindustan.com/tags/gaming', keyword: 'गेमिंग' }
    ],
    'Entertainment': [
      { site: 'filmibeat.com/hindi', keyword: 'मनोरंजन' },
      { site: 'bollywoodhungama.com/hindi', keyword: 'बॉलीवुड' }, // Added /hindi
      { site: 'koimoi.com/hindi', keyword: 'मनोरंजन समाचार' }, // Added /hindi
      { site: 'pinkvilla.com/hindi', keyword: 'मनोरंजन' }, // Added /hindi
      { site: 'ndtv.in/entertainment', keyword: 'मनोरंजन' } // Changed timesofindia to ndtv.in
    ],
    'Art and Culture': [
      { site: 'bbc.com/hindi/topics/c830k44m7zpt', keyword: 'कला संस्कृति' },
      { site: 'thewirehindi.com/culture', keyword: 'संस्कृति' },
      { site: 'aajtak.in/literature', keyword: 'साहित्य' },
      { site: 'amarujala.com/kavya', keyword: 'कला' },
      { site: 'hindustantimes.com/hindi/lifestyle/art-culture', keyword: 'संस्कृति' }
    ],
    'Science': [
      { site: 'vigyanprasar.gov.in', keyword: 'विज्ञान' },
      { site: 'bbc.com/hindi/topics/cq5nwxwy1w5t', keyword: 'विज्ञान' }, // Corrected topic
      { site: 'dw.com/hi/विज्ञान', keyword: 'विज्ञान समाचार' },
      { site: 'navbharattimes.indiatimes.com/science/articlelist/2278853.cms', keyword: 'विज्ञान' },
      { site: 'jagran.com/technology/science', keyword: 'विज्ञान' }
    ],
    'Health': [
      { site: 'myupchar.com/tips', keyword: 'स्वास्थ्य' }, // Added /tips
      { site: 'onlymyhealth.com/hindi', keyword: 'स्वास्थ्य समाचार' },
      { site: 'webdunia.com/hindi-health', keyword: 'स्वास्थ्य' }, // Changed webmd
      { site: 'navbharattimes.indiatimes.com/lifestyle/health/articlelist/2278846.cms', keyword: 'स्वास्थ्य' },
      { site: 'jagran.com/lifestyle/health', keyword: 'स्वास्थ्य' }
    ],
    'Travel': [
      { site: 'nativeplanet.com/hindi', keyword: 'यात्रा' },
      { site: 'navbharattimes.indiatimes.com/travel/articlelist/2278856.cms', keyword: 'यात्रा' },
      { site: 'jagran.com/travel', keyword: 'पर्यटन' },
      { site: 'amarujala.com/travel', keyword: 'यात्रा समाचार' },
      { site: 'hindi.holidayrider.com', keyword: 'यात्रा' } // Changed holidayfy
    ]
  },

  // Japanese sources - ja
  'ja': {
    'Technology': [
      { site: 'techcrunch.com/jp', keyword: 'テクノロジー' },
      { site: 'wired.jp', keyword: 'テック' },
      { site: 'itmedia.co.jp/news', keyword: 'テクノロジー' },
      { site: 'engadget.com/jp', keyword: 'テック' },
      { site: 'gizmodo.jp', keyword: 'テクノロジー' }
    ],
    'AI': [
      { site: 'nikkei.com/t2m/ai', keyword: '人工知能' },
      { site: 'itmedia.co.jp/aiplus', keyword: 'AI' },
      { site: 'ainow.ai', keyword: '人工知能' },
      { site: 'webtan.impress.co.jp/l/7221', keyword: 'AI' },
      { site: 'robosta.info', keyword: '人工知能' }
    ],
    'Current News': [
      { site: 'nhk.or.jp/news', keyword: 'ニュース' },
      { site: 'asahi.com', keyword: 'ニュース' },
      { site: 'yomiuri.co.jp', keyword: 'ニュース' },
      { site: 'mainichi.jp', keyword: 'ニュース' },
      { site: 'news.yahoo.co.jp', keyword: 'ニュース' }
    ],
    'Sports': [
      { site: 'sports.yahoo.co.jp', keyword: 'スポーツ' },
      { site: 'nikkansports.com', keyword: 'スポーツ' },
      { site: 'sponichi.co.jp/sports', keyword: 'スポーツ' },
      { site: 'sports.nhk.or.jp', keyword: 'スポーツニュース' },
      { site: 'sportiva.shueisha.co.jp', keyword: 'スポーツ' }
    ],
    'Money': [
      { site: 'nikkei.com', keyword: '経済' },
      { site: 'toyokeizai.net', keyword: '金融' },
      { site: 'diamond.jp', keyword: '経済' },
      { site: 'president.jp', keyword: '金融' },
      { site: 'money.yahoo.co.jp', keyword: '経済' }
    ],
    'Gaming': [
      { site: 'famitsu.com', keyword: 'ゲーム' },
      { site: '4gamer.net', keyword: 'ゲーム' },
      { site: 'gamespark.jp', keyword: 'ゲームニュース' },
      { site: 'denfaminicogamer.jp', keyword: 'ゲーム' },
      { site: 'inside-games.jp', keyword: 'ゲーム' }
    ],
    'Entertainment': [
      { site: 'news.yahoo.co.jp/categories/entertainment', keyword: 'エンタメ' },
      { site: 'oricon.co.jp/news', keyword: 'エンターテイメント' },
      { site: 'natalie.mu/music', keyword: '音楽' },
      { site: 'natalie.mu/eiga', keyword: '映画' },
      { site: 'mantan-web.jp', keyword: 'エンタメ' }
    ],
    'Art and Culture': [
      { site: 'bijutsutecho.com', keyword: 'アート' },
      { site: 'cinra.net/category/art-culture', keyword: 'カルチャー' },
      { site: 'timeout.jp/tokyo/ja/art', keyword: 'アート' },
      { site: 'artscape.jp', keyword: '美術' },
      { site: 'natalie.mu/stage', keyword: '文化' }
    ],
    'Science': [
      { site: 'natgeo.nikkeibp.co.jp', keyword: '科学' },
      { site: 'sorae.info', keyword: '科学' },
      { site: 'sciencenews.co.jp', keyword: '科学ニュース' },
      { site: 'news.mynavi.jp/techplus/science', keyword: '科学' },
      { site: 'scienceportal.jst.go.jp', keyword: '科学' } // Changed astropics
    ],
    'Health': [
      { site: 'yomidr.yomiuri.co.jp', keyword: '健康' },
      { site: 'health.nikkei.com', keyword: '健康' },
      { site: 'kenko100.jp', keyword: '健康ニュース' },
      { site: 'medpeer.jp/column', keyword: '医療' },
      { site: 'news.yahoo.co.jp/categories/health', keyword: '健康' }
    ],
    'Travel': [
      { site: 'travel.watch.impress.co.jp', keyword: '旅行' },
      { site: 'travelvoice.jp', keyword: '旅行ニュース' },
      { site: 'traicy.com', keyword: '旅行' },
      { site: 'tabi-labo.com/feature/travel', keyword: '旅行' },
      { site: 'news.yahoo.co.jp/categories/travel', keyword: '旅行' }
    ]
  },

  // Korean sources - ko
  'ko': {
    'Technology': [
      { site: 'zdnet.co.kr', keyword: '기술' },
      { site: 'etnews.com', keyword: '테크' },
      { site: 'bloter.net', keyword: '기술' },
      { site: 'it.chosun.com', keyword: '테크' },
      { site: 'techm.kr', keyword: '기술 뉴스' }
    ],
    'AI': [
      { site: 'aitimes.com', keyword: '인공지능' },
      { site: 'the-ai.kr', keyword: 'AI' },
      { site: 'zdnet.co.kr/newskey/?lstcode=AI', keyword: '인공지능 뉴스' },
      { site: 'mk.co.kr/ai', keyword: 'AI' },
      { site: 'etnews.com/news/section.html?id1=19', keyword: '인공지능' }
    ],
    'Current News': [
      { site: 'news.naver.com', keyword: '뉴스' },
      { site: 'news.daum.net', keyword: '뉴스' },
      { site: 'chosun.com', keyword: '뉴스' },
      { site: 'joongang.co.kr', keyword: '뉴스' },
      { site: 'donga.com', keyword: '뉴스' }
    ],
    'Sports': [
      { site: 'sports.naver.com', keyword: '스포츠' },
      { site: 'sports.daum.net', keyword: '스포츠' },
      { site: 'sports.chosun.com', keyword: '스포츠 뉴스' },
      { site: 'sportsseoul.com', keyword: '스포츠' },
      { site: 'spotvnews.co.kr', keyword: '스포츠' }
    ],
    'Money': [
      { site: 'mk.co.kr', keyword: '경제' },
      { site: 'hankyung.com', keyword: '금융' },
      { site: 'news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=101', keyword: '경제 뉴스' },
      { site: 'news.mt.co.kr', keyword: '경제' },
      { site: 'edaily.co.kr', keyword: '금융' }
    ],
    'Gaming': [
      { site: 'inven.co.kr', keyword: '게임' },
      { site: 'thisisgame.com', keyword: '게임 뉴스' },
      { site: 'gamemeca.com', keyword: '게임' },
      { site: 'gamefocus.co.kr', keyword: '게임' },
      { site: 'gamechosun.co.kr', keyword: '게임' }
    ],
    'Entertainment': [
      { site: 'news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=106', keyword: '연예' },
      { site: 'dispatch.co.kr', keyword: '연예 뉴스' },
      { site: 'tenasia.hankyung.com', keyword: '연예' },
      { site: 'newsen.com', keyword: '연예' },
      { site: 'star.mt.co.kr', keyword: '연예' }
    ],
    'Art and Culture': [
      { site: 'artinsight.co.kr', keyword: '예술' },
      { site: 'yna.co.kr/culture/arts-performance', keyword: '문화' }, // Changed cnnews
      { site: 'culture.chosun.com', keyword: '문화 예술' },
      { site: 'hankyung.com/life/culture', keyword: '문화' },
      { site: 'art.mk.co.kr', keyword: '예술' }
    ],
    'Science': [
      { site: 'dongascience.com', keyword: '과학' },
      { site: 'sciencetimes.co.kr', keyword: '과학 뉴스' },
      { site: 'hellodd.com', keyword: '과학' },
      { site: 'zdnet.co.kr/newskey/?lstcode=sci', keyword: '과학' },
      { site: 'etnews.com/news/section.html?id1=04', keyword: '과학' }
    ],
    'Health': [
      { site: 'kormedi.com', keyword: '건강' },
      { site: 'health.chosun.com', keyword: '건강 뉴스' },
      { site: 'hidoc.co.kr', keyword: '건강' },
      { site: 'healtho.co.kr', keyword: '건강' },
      { site: 'mdjournal.kr', keyword: '의료' }
    ],
    'Travel': [
      { site: 'traveltimes.co.kr', keyword: '여행' },
      { site: 'ttg.co.kr', keyword: '여행 뉴스' }, // Changed ttgholic
      { site: 'travie.com', keyword: '여행' },
      { site: 'tournews21.com', keyword: '여행' },
      { site: 'ktnbm.co.kr', keyword: '관광' } // Changed ktsketch
    ]
  },

  // Portuguese sources - pt / pt-BR
  'pt': {
    'Technology': [
      { site: 'g1.globo.com/tecnologia', keyword: 'tecnologia' },
      { site: 'tecmundo.com.br', keyword: 'tecnologia' },
      { site: 'canaltech.com.br', keyword: 'tech' },
      { site: 'olhardigital.com.br', keyword: 'tecnologia' },
      { site: 'uol.com.br/tilt', keyword: 'tech' }
    ],
    'AI': [
      { site: 'canaltech.com.br/inteligencia-artificial', keyword: 'inteligência artificial' },
      { site: 'tecmundo.com.br/inteligencia-artificial', keyword: 'IA' },
      { site: 'mittechreview.com.br', keyword: 'inteligência artificial' },
      { site: 'olhardigital.com.br/tag/inteligencia-artificial', keyword: 'IA' },
      { site: 'g1.globo.com/tecnologia/inteligencia-artificial', keyword: 'inteligência artificial' }
    ],
    'Current News': [
      { site: 'g1.globo.com', keyword: 'notícias' },
      { site: 'uol.com.br', keyword: 'notícias' },
      { site: 'folha.uol.com.br', keyword: 'notícias' },
      { site: 'estadao.com.br', keyword: 'notícias' },
      { site: 'cnnbrasil.com.br', keyword: 'notícias' }
    ],
    'Sports': [
      { site: 'ge.globo.com', keyword: 'esportes' },
      { site: 'uol.com.br/esporte', keyword: 'esportes' },
      { site: 'espn.com.br', keyword: 'esportes' },
      { site: 'lance.com.br', keyword: 'esportes' },
      { site: 'gazetaesportiva.com', keyword: 'futebol' }
    ],
    'Money': [
      { site: 'g1.globo.com/economia', keyword: 'economia' },
      { site: 'valor.globo.com', keyword: 'finanças' },
      { site: 'infomoney.com.br', keyword: 'economia' },
      { site: 'exame.com/economia', keyword: 'finanças' },
      { site: 'moneytimes.com.br', keyword: 'mercado' }
    ],
    'Gaming': [
      { site: 'techtudo.com.br/games', keyword: 'games' },
      { site: 'ign.com/br', keyword: 'jogos' },
      { site: 'versus.com.br', keyword: 'games' },
      { site: 'theenemy.com.br', keyword: 'jogos' },
      { site: 'adrenaline.com.br/games', keyword: 'games' }
    ],
    'Entertainment': [
      { site: 'gshow.globo.com', keyword: 'entretenimento' },
      { site: 'uol.com.br/splash', keyword: 'entretenimento' },
      { site: 'hugogloss.uol.com.br', keyword: 'famosos' },
      { site: 'omelete.com.br', keyword: 'cultura pop' },
      { site: 'adorocinema.com', keyword: 'cinema' }
    ],
    'Art and Culture': [
      { site: 'cultura.estadao.com.br', keyword: 'arte' },
      { site: 'folha.uol.com.br/ilustrada', keyword: 'cultura' },
      { site: 'g1.globo.com/pop-arte', keyword: 'arte e cultura' },
      { site: 'revistacult.uol.com.br', keyword: 'cultura' }, // Changed forum
      { site: 'cartacapital.com.br/cultura', keyword: 'cultura' }
    ],
    'Science': [
      { site: 'g1.globo.com/ciencia-e-saude', keyword: 'ciência' },
      { site: 'revistapesquisa.fapesp.br', keyword: 'ciência' },
      { site: 'canaltech.com.br/ciencia', keyword: 'ciência' }, // Changed uol/vivabem
      { site: 'cnnbrasil.com.br/tecnologia/ciencia', keyword: 'ciência' },
      { site: 'super.abril.com.br/ciencia', keyword: 'ciência' }
    ],
    'Health': [
      { site: 'g1.globo.com/ciencia-e-saude', keyword: 'saúde' },
      { site: 'uol.com.br/vivabem', keyword: 'saúde' },
      { site: 'saude.abril.com.br', keyword: 'saúde' },
      { site: 'drauziovarella.uol.com.br', keyword: 'saúde' },
      { site: 'minhavida.com.br', keyword: 'saúde' }
    ],
    'Travel': [
      { site: 'viagemeturismo.abril.com.br', keyword: 'viagem' },
      { site: 'melhoresdestinos.com.br', keyword: 'turismo' },
      { site: 'catracalivre.com.br/viagem', keyword: 'viagem' },
      { site: 'g1.globo.com/turismo-e-viagem', keyword: 'viagem' },
      { site: 'viajenaviagem.com', keyword: 'turismo' }
    ]
  },

  // Russian sources - ru
  'ru': {
    'Technology': [
      { site: 'cnews.ru', keyword: 'технологии' },
      { site: '3dnews.ru', keyword: 'технологии' },
      { site: 'ixbt.com', keyword: 'технологии' },
      { site: 'habr.com/ru/news', keyword: 'технологии' },
      { site: 'lenta.ru/rubrics/science/technologies', keyword: 'технологии' }
    ],
    'AI': [
      { site: 'cnews.ru', keyword: 'искусственный интеллект' },
      { site: 'habr.com/ru/hub/artificial_intelligence', keyword: 'ИИ' },
      { site: 'lenta.ru/tags/organizations/iskusstvennyj-intellekt', keyword: 'ИИ' },
      { site: 'kommersant.ru/theme/1117', keyword: 'искусственный интеллект' }, // Changed theme
      { site: 'rbc.ru/technology_and_media', keyword: 'ИИ' }
    ],
    'Current News': [
      { site: 'lenta.ru', keyword: 'новости' },
      { site: 'rbc.ru', keyword: 'новости' },
      { site: 'kommersant.ru', keyword: 'новости' },
      { site: 'vedomosti.ru', keyword: 'новости' },
      { site: 'tass.ru', keyword: 'новости' }
    ],
    'Sports': [
      { site: 'sport-express.ru', keyword: 'спорт' },
      { site: 'sports.ru', keyword: 'спорт' },
      { site: 'championat.com', keyword: 'спорт' },
      { site: 'matchtv.ru/news', keyword: 'спорт' }, // Added /news
      { site: 'tass.ru/sport', keyword: 'спорт' }
    ],
    'Money': [
      { site: 'rbc.ru/economics', keyword: 'экономика' },
      { site: 'kommersant.ru/finance', keyword: 'финансы' },
      { site: 'vedomosti.ru/economics', keyword: 'экономика' },
      { site: 'banki.ru/news', keyword: 'финансы' },
      { site: 'finam.ru/analysis/newsitem', keyword: 'рынок' }
    ],
    'Gaming': [
      { site: 'igromania.ru', keyword: 'игры' },
      { site: 'stopgame.ru', keyword: 'игры' },
      { site: 'playground.ru/news', keyword: 'игры' }, // Added /news
      { site: 'gamemag.ru', keyword: 'игровые новости' },
      { site: 'dtf.ru/games', keyword: 'игры' } // Changed kanobu
    ],
    'Entertainment': [
      { site: 'afisha.ru', keyword: 'развлечения' },
      { site: 'kinopoisk.ru/media', keyword: 'кино' }, // Added /media
      { site: 'lenta.ru/rubrics/culture', keyword: 'развлечения' },
      { site: 'gazeta.ru/culture', keyword: 'кино' },
      { site: 'vokrug.tv', keyword: 'шоу-бизнес' }
    ],
    'Art and Culture': [
      { site: 'culture.ru', keyword: 'культура' },
      { site: 'lenta.ru/rubrics/culture', keyword: 'искусство' },
      { site: 'kommersant.ru/rubric/7', keyword: 'культура' }, // Changed rubric
      { site: 'theartnewspaper.ru', keyword: 'искусство' },
      { site: 'artguide.com', keyword: 'арт' }
    ],
    'Science': [
      { site: 'nplus1.ru', keyword: 'наука' },
      { site: 'lenta.ru/rubrics/science', keyword: 'наука' },
      { site: 'nauka.tass.ru', keyword: 'наука' },
      { site: 'naked-science.ru', keyword: 'наука' },
      { site: 'popmech.ru', keyword: 'наука' }
    ],
    'Health': [
      { site: 'medportal.ru', keyword: 'здоровье' },
      { site: 'doctorpiter.ru', keyword: 'здоровье' },
      { site: 'takzdorovo.ru', keyword: 'здоровье' },
      { site: 'lenta.ru/rubrics/wellness', keyword: 'здоровье' },
      { site: 'aif.ru/health', keyword: 'здоровье' } // Changed rbc
    ],
    'Travel': [
      { site: 'tutu.ru/journal', keyword: 'путешествия' },
      { site: 'tonkosti.ru', keyword: 'туризм' },
      { site: 'travel.ru', keyword: 'путешествия' },
      { site: 'lenta.ru/rubrics/travel', keyword: 'туризм' },
      { site: 'rbc.ru/life/travel', keyword: 'путешествия' }
    ]
  },

  // Spanish sources - es
  'es': {
    'Technology': [
      { site: 'xataka.com', keyword: 'tecnología' },
      { site: 'clipset.com', keyword: 'tech' },
      { site: 'hipertextual.com', keyword: 'tecnología' },
      { site: 'fayerwayer.com', keyword: 'tech' },
      { site: 'enter.co', keyword: 'tecnología' }
    ],
    'AI': [
      { site: 'xataka.com/tag/inteligencia-artificial', keyword: 'inteligencia artificial' },
      { site: 'elpais.com/tecnologia/inteligencia-artificial', keyword: 'IA' },
      { site: 'computerhoy.com/ia', keyword: 'inteligencia artificial' }, // Changed clipset
      { site: 'hipertextual.com/tag/inteligencia-artificial', keyword: 'IA' },
      { site: 'wired.es/articulos/ia', keyword: 'IA' } // Changed computerhoy to wired.es
    ],
    'Current News': [
      { site: 'elpais.com', keyword: 'noticias' },
      { site: 'elmundo.es', keyword: 'noticias' },
      { site: 'bbc.com/mundo', keyword: 'noticias' },
      { site: 'cnnespanol.cnn.com', keyword: 'noticias' },
      { site: 'infobae.com', keyword: 'noticias' }
    ],
    'Sports': [
      { site: 'marca.com', keyword: 'deportes' },
      { site: 'as.com', keyword: 'deportes' },
      { site: 'espn.com.mx', keyword: 'deportes' },
      { site: 'ole.com.ar', keyword: 'futbol' },
      { site: 'sport.es', keyword: 'deportes' }
    ],
    'Money': [
      { site: 'expansion.com', keyword: 'economía' },
      { site: 'eleconomista.es', keyword: 'finanzas' },
      { site: 'ambito.com', keyword: 'economía' },
      { site: 'portafolio.co', keyword: 'finanzas' },
      { site: 'elfinanciero.com.mx', keyword: 'mercados' }
    ],
    'Gaming': [
      { site: 'vandal.elespanol.com', keyword: 'videojuegos' },
      { site: '3djuegos.com', keyword: 'videojuegos' },
      { site: 'levelup.com', keyword: 'gaming' },
      { site: 'meristation.as.com', keyword: 'videojuegos' },
      { site: 'ign.com/es', keyword: 'gaming' }
    ],
    'Entertainment': [
      { site: 'sensacine.com', keyword: 'entretenimiento' },
      { site: 'fotogramas.es', keyword: 'cine' },
      { site: 'peopleenespanol.com', keyword: 'famosos' },
      { site: 'quien.com', keyword: 'entretenimiento' },
      { site: 'infobae.com/teleshow', keyword: 'espectaculos' }
    ],
    'Art and Culture': [
      { site: 'elpais.com/cultura', keyword: 'cultura' },
      { site: 'abc.es/cultura', keyword: 'arte' },
      { site: 'eluniversal.com.mx/cultura', keyword: 'cultura' },
      { site: 'infobae.com/cultura', keyword: 'arte' },
      { site: 'revistadearte.com', keyword: 'arte y cultura' }
    ],
    'Science': [
      { site: 'agenciasinc.es', keyword: 'ciencia' },
      { site: 'nationalgeographic.com.es/ciencia', keyword: 'ciencia' },
      { site: 'muyinteresante.es/ciencia', keyword: 'ciencia' },
      { site: 'bbc.com/mundo/topics/ciencia', keyword: 'ciencia' },
      { site: 'investigacionyciencia.es', keyword: 'ciencia' }
    ],
    'Health': [
      { site: 'cuidateplus.marca.com', keyword: 'salud' },
      { site: 'webconsultas.com', keyword: 'salud' },
      { site: 'salud180.com', keyword: 'salud' },
      { site: 'bbc.com/mundo/topics/salud', keyword: 'salud' },
      { site: 'infosalus.com', keyword: 'salud' }
    ],
    'Travel': [
      { site: 'elviajero.elpais.com', keyword: 'viajes' },
      { site: 'traveler.es', keyword: 'viajes' },
      { site: 'lonelyplanet.es', keyword: 'viajes' },
      { site: 'skyscanner.es/noticias', keyword: 'turismo' },
      { site: 'mexicodesconocido.com.mx', keyword: 'viajes' }
    ]
  }
};
