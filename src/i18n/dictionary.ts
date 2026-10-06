export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: Locale[] = ["ar"];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };

const en = {
  nav: {
    home: "Home", movies: "Movies", series: "Series", arabic: "Arabic", ramadan: "Ramadan", anime: "Anime",
    manga: "Manga", kids: "Kids", classics: "Classics", new: "New", trending: "Trending", collections: "Collections",
    explore: "Explore", search: "Search", watchlist: "My List", profile: "Profile", admin: "Admin", more: "More",
  },
  action: {
    play: "Play", continue: "Continue", trailer: "Trailer", addList: "My List", inList: "In My List", favorite: "Favorite",
    favorited: "Favorited", share: "Share", moreInfo: "More info", signIn: "Sign in", signOut: "Sign out", signUp: "Create account",
    seeAll: "See all", read: "Read", back: "Back", next: "Next episode", prev: "Previous episode", markWatched: "Mark watched",
    retry: "Try again", copied: "Link copied", clear: "Clear filters", save: "Save", cancel: "Cancel", add: "Add",
  },
  section: {
    continue: "Continue Watching", trending: "Trending Now", top10: "Top 10 Today", new: "New Releases",
    movies: "Popular Movies", series: "Popular Series", arabicCinema: "Arabic Cinema", arabicSeries: "Arabic Series",
    moroccan: "Moroccan Productions", ramadan: "Ramadan", anime: "Anime", kids: "Kids & Family", classics: "Classics",
    collections: "Collections", countries: "Arab Countries", genres: "Genres", gems: "Hidden Gems", manga: "Manga",
    similar: "More like this", cast: "Cast & Crew", episodes: "Episodes", volumes: "Volumes & Chapters", related: "Related",
    airing: "Currently Airing", completed: "Completed", upcoming: "Coming Soon", schedule: "Daily schedule",
    newMovies: "New Movies", newSeries: "New Series", mostWatched: "Most Watched", worlds: "Content worlds",
  },
  label: {
    season: "Season", episode: "Episode", min: "min", chapters: "chapters", chapter: "Chapter", volume: "Volume",
    rating: "Rating", year: "Year", genre: "Genre", sort: "Sort", country: "Country", all: "All", status: "Status",
    popular: "Popularity", newest: "Newest", oldest: "Oldest", az: "A–Z", topRated: "Top rated", results: "results",
    director: "Director", creator: "Creator", author: "Author", studio: "Studio", languages: "Languages", countries: "Countries",
    age: "Age", kidsProfile: "Kids profile", airTime: "Airs at", released: "Released", airing: "Airing", completed: "Completed",
    upcoming: "Upcoming", format: "Format", catalogOnly: "Catalog listing — reading is available only for authorized titles.",
  },
  auth: {
    title: "Welcome to MOROBEST", subtitle: "Sign in to sync your list, progress and profiles across devices.",
    email: "Email", password: "Password", google: "Continue with Google", or: "or", noAccount: "New here?",
    haveAccount: "Already a member?", forgot: "Forgot password?", resetSent: "Check your inbox for a reset link.",
    checkEmail: "Check your inbox to confirm your email.", newPassword: "New password", updatePassword: "Update password",
    whoWatching: "Who's watching?", addProfile: "Add profile", profileName: "Profile name", manageProfiles: "Manage profiles",
  },
  empty: {
    search: "Nothing matches that search yet.", list: "Your list is empty. Save titles to watch later.",
    history: "Nothing watched yet.", generic: "Nothing here yet.", searchHint: "Search movies, series, anime and manga",
  },
  error: {
    notFound: "This page wandered off into the desert.", generic: "Something went wrong on our side.",
    unavailable: "This title is not available right now.", playback: "Playback could not start.", unsupported: "This video cannot be played in this browser.", offline: "You appear to be offline.",
  },
  hero: { tagline: "Cinema of the world. Soul of Morocco." },
  footer: { rights: "All rights reserved.", legal: "Only licensed and authorized content is streamed on MOROBEST.", privacy: "Privacy" },
};

export type Dict = typeof en;

const fr: Dict = {
  nav: {
    home: "Accueil", movies: "Films", series: "Séries", arabic: "Arabe", ramadan: "Ramadan", anime: "Anime", manga: "Manga",
    kids: "Enfants", classics: "Classiques", new: "Nouveautés", trending: "Tendances", collections: "Collections",
    explore: "Explorer", search: "Recherche", watchlist: "Ma liste", profile: "Profil", admin: "Admin", more: "Plus",
  },
  action: {
    play: "Lecture", continue: "Reprendre", trailer: "Bande-annonce", addList: "Ma liste", inList: "Dans ma liste",
    favorite: "Favori", favorited: "En favori", share: "Partager", moreInfo: "Plus d'infos", signIn: "Connexion",
    signOut: "Déconnexion", signUp: "Créer un compte", seeAll: "Tout voir", read: "Lire", back: "Retour",
    next: "Épisode suivant", prev: "Épisode précédent", markWatched: "Marquer vu", retry: "Réessayer", copied: "Lien copié",
    clear: "Effacer", save: "Enregistrer", cancel: "Annuler", add: "Ajouter",
  },
  section: {
    continue: "Reprendre la lecture", trending: "Tendances", top10: "Top 10 du jour", new: "Nouveautés",
    movies: "Films populaires", series: "Séries populaires", arabicCinema: "Cinéma arabe", arabicSeries: "Séries arabes",
    moroccan: "Productions marocaines", ramadan: "Ramadan", anime: "Anime", kids: "Enfants & Famille", classics: "Classiques",
    collections: "Collections", countries: "Pays arabes", genres: "Genres", gems: "Pépites", manga: "Manga",
    similar: "Titres similaires", cast: "Distribution", episodes: "Épisodes", volumes: "Tomes & chapitres", related: "Liés",
    airing: "En diffusion", completed: "Terminées", upcoming: "Bientôt", schedule: "Programme du jour",
    newMovies: "Nouveaux films", newSeries: "Nouvelles séries", mostWatched: "Les plus vus", worlds: "Univers",
  },
  label: {
    season: "Saison", episode: "Épisode", min: "min", chapters: "chapitres", chapter: "Chapitre", volume: "Tome",
    rating: "Note", year: "Année", genre: "Genre", sort: "Trier", country: "Pays", all: "Tous", status: "Statut",
    popular: "Popularité", newest: "Plus récents", oldest: "Plus anciens", az: "A–Z", topRated: "Mieux notés",
    results: "résultats", director: "Réalisation", creator: "Création", author: "Auteur", studio: "Studio",
    languages: "Langues", countries: "Pays", age: "Âge", kidsProfile: "Profil enfant", airTime: "Diffusion",
    released: "Sorti", airing: "En cours", completed: "Terminé", upcoming: "À venir", format: "Format",
    catalogOnly: "Fiche catalogue — la lecture n'est disponible que pour les titres autorisés.",
  },
  auth: {
    title: "Bienvenue sur MOROBEST", subtitle: "Connectez-vous pour synchroniser votre liste et vos profils.",
    email: "E-mail", password: "Mot de passe", google: "Continuer avec Google", or: "ou", noAccount: "Nouveau ?",
    haveAccount: "Déjà membre ?", forgot: "Mot de passe oublié ?", resetSent: "Un lien de réinitialisation vous a été envoyé.",
    checkEmail: "Confirmez votre e-mail via le lien reçu.", newPassword: "Nouveau mot de passe",
    updatePassword: "Mettre à jour", whoWatching: "Qui regarde ?", addProfile: "Ajouter un profil",
    profileName: "Nom du profil", manageProfiles: "Gérer les profils",
  },
  empty: {
    search: "Aucun résultat pour cette recherche.", list: "Votre liste est vide.", history: "Rien regardé pour l'instant.",
    generic: "Rien pour le moment.", searchHint: "Films, séries, anime et manga",
  },
  error: {
    notFound: "Cette page s'est perdue dans le désert.", generic: "Une erreur est survenue.",
    unavailable: "Ce titre n'est pas disponible.", playback: "La lecture n'a pas pu démarrer.",  unsupported: "Cette vidéo ne peut pas être lue dans ce navigateur.", offline: "Vous semblez hors ligne.",
  },
  hero: { tagline: "Le cinéma du monde. L'âme du Maroc." },
  footer: { rights: "Tous droits réservés.", legal: "MOROBEST ne diffuse que des contenus sous licence.", privacy: "Confidentialité" },
};

const ar: Dict = {
  nav: {
    home: "الرئيسية", movies: "أفلام", series: "مسلسلات", arabic: "عربي", ramadan: "رمضان", anime: "أنمي", manga: "مانغا",
    kids: "أطفال", classics: "كلاسيكيات", new: "جديد", trending: "الرائج", collections: "مجموعات", explore: "استكشف",
    search: "بحث", watchlist: "قائمتي", profile: "الملف", admin: "الإدارة", more: "المزيد",
  },
  action: {
    play: "تشغيل", continue: "متابعة", trailer: "الإعلان", addList: "قائمتي", inList: "في قائمتي", favorite: "مفضلة",
    favorited: "في المفضلة", share: "مشاركة", moreInfo: "تفاصيل", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج",
    signUp: "إنشاء حساب", seeAll: "عرض الكل", read: "قراءة", back: "رجوع", next: "الحلقة التالية", prev: "الحلقة السابقة",
    markWatched: "تمت المشاهدة", retry: "إعادة المحاولة", copied: "تم نسخ الرابط", clear: "مسح", save: "حفظ", cancel: "إلغاء", add: "إضافة",
  },
  section: {
    continue: "تابع المشاهدة", trending: "الرائج الآن", top10: "أفضل 10 اليوم", new: "أحدث الإصدارات",
    movies: "أفلام شائعة", series: "مسلسلات شائعة", arabicCinema: "السينما العربية", arabicSeries: "المسلسلات العربية",
    moroccan: "إنتاجات مغربية", ramadan: "رمضان", anime: "أنمي", kids: "الأطفال والعائلة", classics: "كلاسيكيات",
    collections: "مجموعات", countries: "الدول العربية", genres: "التصنيفات", gems: "جواهر مخفية", manga: "مانغا",
    similar: "أعمال مشابهة", cast: "طاقم العمل", episodes: "الحلقات", volumes: "المجلدات والفصول", related: "ذات صلة",
    airing: "يُعرض الآن", completed: "مكتملة", upcoming: "قريباً", schedule: "جدول اليوم",
    newMovies: "أفلام جديدة", newSeries: "مسلسلات جديدة", mostWatched: "الأكثر مشاهدة", worlds: "العوالم",
  },
  label: {
    season: "الموسم", episode: "الحلقة", min: "د", chapters: "فصول", chapter: "الفصل", volume: "المجلد", rating: "التقييم",
    year: "السنة", genre: "التصنيف", sort: "ترتيب", country: "البلد", all: "الكل", status: "الحالة", popular: "الأكثر شعبية",
    newest: "الأحدث", oldest: "الأقدم", az: "أ–ي", topRated: "الأعلى تقييماً", results: "نتيجة", director: "إخراج",
    creator: "تأليف", author: "المؤلف", studio: "الاستوديو", languages: "اللغات", countries: "الدول", age: "العمر",
    kidsProfile: "ملف طفل", airTime: "موعد العرض", released: "صدر", airing: "يُعرض", completed: "مكتمل", upcoming: "قادم",
    format: "النوع", catalogOnly: "بطاقة فهرس — القراءة متاحة فقط للأعمال المرخصة.",
  },
  auth: {
    title: "مرحباً بك في موروبيست", subtitle: "سجّل الدخول لمزامنة قائمتك وملفاتك على كل الأجهزة.",
    email: "البريد الإلكتروني", password: "كلمة المرور", google: "المتابعة عبر Google", or: "أو", noAccount: "جديد هنا؟",
    haveAccount: "لديك حساب؟", forgot: "نسيت كلمة المرور؟", resetSent: "تحقق من بريدك لإعادة التعيين.",
    checkEmail: "تحقق من بريدك لتأكيد الحساب.", newPassword: "كلمة مرور جديدة", updatePassword: "تحديث",
    whoWatching: "من يشاهد؟", addProfile: "إضافة ملف", profileName: "اسم الملف", manageProfiles: "إدارة الملفات",
  },
  empty: {
    search: "لا توجد نتائج.", list: "قائمتك فارغة.", history: "لم تشاهد شيئاً بعد.", generic: "لا شيء هنا بعد.",
    searchHint: "ابحث عن أفلام ومسلسلات وأنمي ومانغا",
  },
  error: {
    notFound: "ضلّت هذه الصفحة طريقها في الصحراء.", generic: "حدث خطأ ما.", unavailable: "هذا العمل غير متاح حالياً.",
    playback: "تعذّر بدء التشغيل.", unsupported: "لا يمكن تشغيل هذا الفيديو في هذا المتصفح.", offline: "يبدو أنك غير متصل.",
  },
  hero: { tagline: "سينما العالم. روح المغرب." },
  footer: { rights: "جميع الحقوق محفوظة.", legal: "تعرض موروبيست المحتوى المرخص فقط.", privacy: "الخصوصية" },
};

export const DICTS: Record<Locale, Dict> = { en, fr, ar };
