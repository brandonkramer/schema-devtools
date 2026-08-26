/**
 * Google Rich-Result Rule Catalog.
 * Declarative requirements and recommendations based on Google Search Central documentation.
 * @file
 */

/** @typedef {import('../types.js').TypeRule} TypeRule */

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
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'image', 'offers', 'performer', 'organizer'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/event',
  },
  {
    type: 'Recipe',
    required: ['name'],
    recommended: ['image', 'author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
  },
  {
    type: 'JobPosting',
    required: ['title', 'description', 'datePosted', 'hiringOrganization'],
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
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'duration', 'embedUrl'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/video',
  },
  {
    type: 'SoftwareApplication',
    required: ['name'],
    recommended: ['operatingSystem', 'applicationCategory', 'offers', 'aggregateRating'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/software-app',
  },
  {
    type: 'Course',
    required: ['name', 'provider'],
    recommended: ['description', 'offers'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/course',
  },
  {
    type: 'Review',
    required: ['itemReviewed', 'reviewRating', 'author'],
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
    required: ['author', 'datePublished'],
    recommended: ['url', 'comment'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
  },
  {
    type: 'SocialMediaPosting',
    required: ['author', 'datePublished'],
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
    required: ['name'],
    recommended: ['description', 'license', 'creator', 'distribution'],
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
