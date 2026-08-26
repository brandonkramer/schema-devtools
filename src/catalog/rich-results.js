/**
 * Google Rich-Result Rule Catalog.
 * Declarative requirements and recommendations based on Google Search Central documentation.
 * @file
 */

/** @typedef {import('../types.js').TypeRule} TypeRule */

/** Schema.org LocalBusiness subtypes supported by Google's Local Business guide. */
export const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'AccountingService', 'AnimalShelter', 'Attorney', 'AutomotiveBusiness',
  'Bakery', 'BarOrPub', 'BeautySalon', 'BedAndBreakfast', 'BikeStore', 'BookStore',
  'BowlingAlley', 'Brewery', 'CafeOrCoffeeShop', 'Campground', 'Casino', 'ChildCare',
  'ClothingStore', 'ComputerStore', 'ConvenienceStore', 'DaySpa', 'Dentist',
  'DepartmentStore', 'Distillery', 'DryCleaningOrLaundry', 'Electrician',
  'EmergencyService', 'EmploymentAgency', 'EntertainmentBusiness', 'ExerciseGym',
  'FastFoodRestaurant', 'FinancialService', 'Florist', 'FoodEstablishment',
  'FurnitureStore', 'GardenStore', 'GasStation', 'GeneralContractor', 'GolfCourse',
  'GovernmentOffice', 'GroceryStore', 'HardwareStore', 'HealthAndBeautyBusiness',
  'HealthClub', 'HobbyShop', 'HomeAndConstructionBusiness', 'Hostel', 'Hotel',
  'HVACBusiness', 'IceCreamShop', 'InsuranceAgency', 'InternetCafe', 'JewelryStore',
  'LegalService', 'Library', 'LiquorStore', 'LodgingBusiness', 'Locksmith',
  'MedicalBusiness', 'MensClothingStore', 'Motel', 'MotorcycleDealer',
  'MovieTheater', 'MovingCompany', 'MusicStore', 'NightClub', 'Notary',
  'OfficeEquipmentStore', 'Optician', 'OutletStore', 'PawnShop', 'PetStore', 'Pharmacy',
  'Plumber', 'PoliceStation', 'PostOffice', 'ProfessionalService',
  'RadioStation', 'RealEstateAgent', 'RecyclingCenter', 'Resort', 'Restaurant',
  'RoofingContractor', 'SelfStorage', 'ShoeStore', 'ShoppingCenter', 'SkiResort',
  'SportingGoodsStore', 'SportsActivityLocation', 'Store', 'TattooParlor',
  'TelevisionStation', 'TireShop', 'TouristInformationCenter',
  'ToyStore', 'TravelAgency', 'WholesaleStore',
]);

/** @type {TypeRule[]} */
export const RICH_RESULT_RULES = [
  {
    type: 'NewsArticle',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'BlogPosting',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'Article',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'Product',
    required: ['name'],
    anyOf: [['offers', 'review', 'aggregateRating']],
    recommended: ['image', 'description', 'offers', 'brand', 'sku', 'aggregateRating', 'review'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product',
  },
  {
    type: 'BreadcrumbList',
    required: ['itemListElement'],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
  },
  {
    type: 'Event',
    required: ['name', 'startDate', 'location', 'location.address'],
    recommended: ['endDate', 'description', 'image', 'offers', 'performer', 'organizer'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/event',
  },
  {
    type: 'Recipe',
    required: ['name', 'image'],
    recommended: ['author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
  },
  {
    type: 'JobPosting',
    required: ['title', 'description', 'datePosted', 'hiringOrganization', 'hiringOrganization.name'],
    anyOf: [['jobLocation', 'applicantLocationRequirements']],
    recommended: ['jobLocation', 'baseSalary', 'employmentType', 'validThrough'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
  },
  {
    type: 'LocalBusiness',
    required: ['name', 'address'],
    recommended: ['image', 'telephone', 'openingHoursSpecification', 'geo', 'url'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
  },
  {
    type: 'Organization',
    required: [],
    recommended: ['name', 'url', 'logo', 'sameAs', 'contactPoint'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/organization',
  },
  {
    type: 'VideoObject',
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'description', 'duration', 'embedUrl'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/video',
  },
  {
    type: 'SoftwareApplication',
    required: ['name', 'offers.price'],
    anyOf: [['aggregateRating', 'review']],
    recommended: ['operatingSystem', 'applicationCategory'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/software-app',
  },
  {
    type: 'Course',
    required: ['name', 'description'],
    recommended: ['provider'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/course',
  },
  {
    type: 'Review',
    required: ['reviewRating', 'reviewRating.ratingValue', 'author', 'author.name'],
    recommended: ['datePublished', 'reviewBody'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
  },
  {
    type: 'QAPage',
    required: ['mainEntity'],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/qapage',
  },
  {
    type: 'ProfilePage',
    required: ['mainEntity'],
    recommended: ['dateCreated', 'dateModified'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
  },
  {
    type: 'DiscussionForumPosting',
    required: ['author', 'author.name', 'datePublished'],
    recommended: ['url', 'comment'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
  },
  {
    type: 'SocialMediaPosting',
    required: ['author', 'author.name', 'datePublished'],
    recommended: ['url', 'comment'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
  },
  {
    type: 'ItemList',
    required: ['itemListElement'],
    recommended: ['numberOfItems', 'itemListOrder'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/carousel',
  },
  {
    type: 'Dataset',
    required: ['name', 'description'],
    recommended: ['license', 'creator', 'distribution'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/dataset',
  },
  {
    type: 'ProductGroup',
    required: ['name'],
    recommended: ['hasVariant', 'variesBy', 'productGroupID'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product-variants',
  },
  {
    type: 'MerchantReturnPolicy',
    required: [],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/return-policy',
  },
  {
    type: 'OfferShippingDetails',
    required: [],
    recommended: ['shippingRate', 'deliveryTime', 'shippingDestination'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing#shipping',
  },
];
