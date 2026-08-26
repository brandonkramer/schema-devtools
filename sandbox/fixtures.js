export const FIXTURES = {
  'e-commerce': {
    name: 'E-Commerce Product (Offers, Reviews, Brand)',
    url: 'https://example.com/products/wireless-headphones',
    canonical: 'https://example.com/products/wireless-headphones',
    entities: [
      {
        id: 'https://example.com/products/wireless-headphones#brand',
        types: ['Brand', 'Organization'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Brand',
          '@id': 'https://example.com/products/wireless-headphones#brand',
          name: 'SoundWave Audio',
          url: 'https://example.com',
          sameAs: 'https://wikidata.org/wiki/Q99999',
        },
      },
      {
        id: 'https://example.com/products/wireless-headphones#product',
        types: ['Product'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': 'https://example.com/products/wireless-headphones#product',
          name: 'SoundWave Pro Wireless ANC Headphones',
          description: 'High fidelity active noise cancelling Bluetooth headphones with 40h battery life.',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
          sku: 'SW-ANC-400',
          mpn: '920-008001',
          brand: { '@id': 'https://example.com/products/wireless-headphones#brand' },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '342',
            bestRating: '5',
            worstRating: '1',
          },
          offers: {
            '@type': 'Offer',
            price: '249.99',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: '2026-12-31',
            seller: { '@id': 'https://example.com/products/wireless-headphones#brand' },
          },
        },
      },
    ],
  },

  article: {
    name: 'Multi-Author Article & Publisher Graph',
    url: 'https://example.com/news/structured-data-2026',
    canonical: 'https://example.com/news/structured-data-2026',
    entities: [
      {
        id: 'https://example.com/#publisher',
        types: ['NewsMediaOrganization', 'Organization'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'NewsMediaOrganization',
          '@id': 'https://example.com/#publisher',
          name: 'Tech Chronicle',
          url: 'https://example.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://example.com/logo.png',
            width: '600',
            height: '60',
          },
          sameAs: ['https://twitter.com/techchronicle', 'https://wikidata.org/wiki/Q11111'],
        },
      },
      {
        id: 'https://example.com/#author-alice',
        types: ['Person'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Person',
          '@id': 'https://example.com/#author-alice',
          name: 'Alice Johnson',
          jobTitle: 'Senior Tech Editor',
          worksFor: { '@id': 'https://example.com/#publisher' },
          sameAs: 'https://twitter.com/alicejohnson',
        },
      },
      {
        id: 'https://example.com/news/structured-data-2026#article',
        types: ['NewsArticle', 'Article'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          '@id': 'https://example.com/news/structured-data-2026#article',
          headline: 'How Schema.org and AI Search Engines Reshaped the Web in 2026',
          datePublished: '2026-08-20T08:00:00+02:00',
          dateModified: '2026-08-26T14:30:00+02:00',
          image: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=600'],
          author: [{ '@id': 'https://example.com/#author-alice' }],
          publisher: { '@id': 'https://example.com/#publisher' },
          mainEntityOfPage: 'https://example.com/news/structured-data-2026',
        },
      },
    ],
  },

  recipe: {
    name: 'Cooking Recipe & Nutrition (SERP Card)',
    url: 'https://example.com/recipes/classic-sourdough',
    canonical: 'https://example.com/recipes/classic-sourdough',
    entities: [
      {
        id: 'https://example.com/recipes/classic-sourdough#recipe',
        types: ['Recipe'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          '@id': 'https://example.com/recipes/classic-sourdough#recipe',
          name: 'Artisan Rustic Sourdough Bread',
          image: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'],
          author: { '@type': 'Person', name: 'Chef Marco' },
          datePublished: '2026-04-15',
          description: 'A crispy crust, airy crumb artisan sourdough bread made with naturally fermented starter.',
          prepTime: 'PT30M',
          cookTime: 'PT45M',
          totalTime: 'PT24H',
          recipeYield: '1 loaf (12 slices)',
          recipeCategory: 'Bread',
          recipeCuisine: 'French',
          keywords: 'sourdough, bread, artisan, baking, sourdough starter',
          nutrition: {
            '@type': 'NutritionInformation',
            calories: '185 calories',
            carbohydrateContent: '36 g',
            proteinContent: '7 g',
          },
          recipeIngredient: [
            '500g bread flour',
            '350g lukewarm water',
            '100g active sourdough starter',
            '10g sea salt',
          ],
          recipeInstructions: [
            { '@type': 'HowToStep', text: 'Mix flour, water, and starter. Autolyse for 45 minutes.' },
            { '@type': 'HowToStep', text: 'Add salt and perform 4 stretch and folds over 2 hours.' },
            { '@type': 'HowToStep', text: 'Shape into a batard and cold retard overnight in the fridge.' },
            { '@type': 'HowToStep', text: 'Bake in a Dutch oven at 450°F (230°C) with lid on for 20 minutes, then lid off for 25 minutes.' },
          ],
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.95',
            reviewCount: '520',
          },
        },
      },
    ],
  },

  restaurant: {
    name: 'LocalBusiness & Restaurant (Menu, Geo, Hours)',
    url: 'https://example.com/bistro',
    canonical: 'https://example.com/bistro',
    entities: [
      {
        id: 'https://example.com/bistro#restaurant',
        types: ['Restaurant', 'LocalBusiness', 'FoodEstablishment'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          '@id': 'https://example.com/bistro#restaurant',
          name: 'Le Bistro Botanique',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500',
          telephone: '+1-415-555-0199',
          servesCuisine: ['French', 'Contemporary Vegetarian'],
          priceRange: '$$$',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '450 Hayes St',
            addressLocality: 'San Francisco',
            addressRegion: 'CA',
            postalCode: '94102',
            addressCountry: 'US',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 37.7765,
            longitude: -122.4242,
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            reviewCount: '488',
          },
          hasMenu: 'https://example.com/bistro/menu',
        },
      },
    ],
  },

  job: {
    name: 'Job Posting & Career (Salary & Location)',
    url: 'https://example.com/careers/lead-devtools-engineer',
    canonical: 'https://example.com/careers/lead-devtools-engineer',
    entities: [
      {
        id: 'https://example.com/careers/lead-devtools-engineer#job',
        types: ['JobPosting'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          '@id': 'https://example.com/careers/lead-devtools-engineer#job',
          title: 'Staff DevTools Platform Engineer',
          description: 'Lead the next generation of browser developer tools and developer experience architectures.',
          datePosted: '2026-08-15',
          validThrough: '2026-11-30',
          employmentType: 'FULL_TIME',
          hiringOrganization: {
            '@type': 'Organization',
            name: 'DevTools Cloud Inc',
            sameAs: 'https://example.com',
            logo: 'https://example.com/logo.png',
          },
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'San Francisco',
              addressRegion: 'CA',
              addressCountry: 'US',
            },
          },
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'USD',
            value: {
              '@type': 'QuantitativeValue',
              minValue: 220000,
              maxValue: 290000,
              unitText: 'YEAR',
            },
          },
        },
      },
    ],
  },

  video: {
    name: 'Video & Media Streaming (Thumbnail & Duration)',
    url: 'https://example.com/videos/structured-data-masterclass',
    canonical: 'https://example.com/videos/structured-data-masterclass',
    entities: [
      {
        id: 'https://example.com/videos/structured-data-masterclass#video',
        types: ['VideoObject', 'MediaObject'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          '@id': 'https://example.com/videos/structured-data-masterclass#video',
          name: 'Structured Data Masterclass for 2026: Schema.org, JSON-LD & LLMs',
          description: 'Comprehensive guide to mastering structured data markup, rich results, and generative engine optimization.',
          thumbnailUrl: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600'],
          uploadDate: '2026-07-10T09:00:00+00:00',
          duration: 'PT28M45S',
          contentUrl: 'https://example.com/stream/structured-data-masterclass.mp4',
          embedUrl: 'https://example.com/embed/masterclass',
        },
      },
    ],
  },

  software: {
    name: 'Software Application & SaaS',
    url: 'https://example.com/apps/schema-cli',
    canonical: 'https://example.com/apps/schema-cli',
    entities: [
      {
        id: 'https://example.com/apps/schema-cli#app',
        types: ['SoftwareApplication'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          '@id': 'https://example.com/apps/schema-cli#app',
          name: 'Schema CLI Tool',
          operatingSystem: 'macOS, Linux, Windows',
          applicationCategory: 'DeveloperApplication',
          offers: {
            '@type': 'Offer',
            price: '0.00',
            priceCurrency: 'USD',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            ratingCount: '120',
          },
        },
      },
    ],
  },

  event: {
    name: 'Event & Ticket Booking',
    url: 'https://example.com/events/web-summit-2026',
    canonical: 'https://example.com/events/web-summit-2026',
    entities: [
      {
        id: 'https://example.com/events/web-summit-2026#event',
        types: ['Event'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Event',
          '@id': 'https://example.com/events/web-summit-2026#event',
          name: 'Global Web Architecture Summit 2026',
          startDate: '2026-10-15T09:00:00+02:00',
          endDate: '2026-10-17T18:00:00+02:00',
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: 'Convention Center',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Amsterdam',
              addressCountry: 'NL',
            },
          },
          offers: {
            '@type': 'Offer',
            url: 'https://example.com/events/web-summit-2026/tickets',
            price: '499.00',
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
          },
        },
      },
    ],
  },

  profile: {
    name: 'ProfilePage & Creator Social Graph (2026)',
    url: 'https://example.com/creators/sarah-dev',
    canonical: 'https://example.com/creators/sarah-dev',
    entities: [
      {
        id: 'https://example.com/creators/sarah-dev#profile',
        types: ['ProfilePage'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          '@id': 'https://example.com/creators/sarah-dev#profile',
          dateCreated: '2026-01-10T12:00:00Z',
          dateModified: '2026-08-25T16:00:00Z',
          mainEntity: {
            '@type': 'Person',
            name: 'Sarah Connor',
            alternateName: 'sarah_dev',
            description: 'Full-stack software architect & tech educator specializing in DevTools and Web Performance.',
            image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
            sameAs: [
              'https://github.com/sarahdev',
              'https://twitter.com/sarahdev',
              'https://youtube.com/@sarahdev',
            ],
            interactionStatistic: [
              {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/FollowAction',
                userInteractionCount: 84500,
              },
            ],
          },
        },
      },
    ],
  },

  breadcrumb: {
    name: 'BreadcrumbList Navigation',
    url: 'https://example.com/electronics/audio/headphones',
    canonical: 'https://example.com/electronics/audio/headphones',
    entities: [
      {
        id: 'https://example.com/electronics/audio/headphones#breadcrumb',
        types: ['BreadcrumbList'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://example.com',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Electronics',
              item: 'https://example.com/electronics',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Audio Equipment',
              item: 'https://example.com/electronics/audio',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: 'Headphones',
              item: 'https://example.com/electronics/audio/headphones',
            },
          ],
        },
      },
    ],
  },

  microdata: {
    name: 'HTML Microdata (LocalBusiness & Hours)',
    url: 'https://example.com/artisan-bakery',
    canonical: 'https://example.com/artisan-bakery',
    entities: [
      {
        id: 'microdata:0',
        types: ['Bakery', 'LocalBusiness'],
        format: 'microdata',
        sourceIndex: 0,
        data: {
          name: 'Golden Crust Bakery',
          description: 'Traditional organic stone-ground breads and French pastries.',
          telephone: '+1-555-0144',
          streetAddress: '120 Market St',
          addressLocality: 'Portland',
          addressRegion: 'OR',
          postalCode: '97201',
          openingHours: 'Mo-Sa 07:00-17:00',
        },
      },
    ],
  },

  rdfa: {
    name: 'RDFa (Book & Author Metadata)',
    url: 'https://example.com/books/web-architecture',
    canonical: 'https://example.com/books/web-architecture',
    entities: [
      {
        id: 'rdfa:0',
        types: ['Book'],
        format: 'rdfa',
        sourceIndex: 0,
        data: {
          name: 'Principles of Modern Web Architecture',
          isbn: '978-0-123456-47-2',
          numberOfPages: '380',
          inLanguage: 'en',
          datePublished: '2026-05-01',
        },
      },
    ],
  },

  errors: {
    name: 'Syntax Errors & Missing Required Fields (Test Editor)',
    url: 'https://example.com/broken-page',
    canonical: 'https://example.com/broken-page',
    entities: [
      {
        id: 'https://example.com/broken-page#item1',
        types: ['Product'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: '', // Empty name (syntax error)
          image: '/relative-path/photo.jpg', // Relative URL warning
          offers: {
            '@type': 'Offer',
            price: 'invalid_price',
            priceValidUntil: '2026-02-31', // Invalid calendar date
          },
        },
      },
    ],
  },

  faq: {
    name: 'FAQPage (Google Retired Notice - 0 Penalty)',
    url: 'https://example.com/help/faq',
    canonical: 'https://example.com/help/faq',
    entities: [
      {
        id: 'https://example.com/help/faq#faq',
        types: ['FAQPage'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How does Schema DevTools work?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'It extracts JSON-LD, Microdata, and RDFa locally in Chrome DevTools with zero network tracking.',
              },
            },
            {
              '@type': 'Question',
              name: 'Does it support Google Rich Results?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes! It checks against 23 official Google Search Gallery rich-result guidelines.',
              },
            },
          ],
        },
      },
    ],
  },

  deprecated: {
    name: 'Deprecated Schema (HowTo / SpecialAnnouncement)',
    url: 'https://example.com/how-to-fix',
    canonical: 'https://example.com/how-to-fix',
    entities: [
      {
        id: 'https://example.com/how-to-fix#howto',
        types: ['HowTo'],
        format: 'jsonld',
        sourceIndex: 0,
        data: {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: 'How to replace a bicycle tire',
          step: [
            { '@type': 'HowToStep', text: 'Deflate the inner tube completely.' },
            { '@type': 'HowToStep', text: 'Use tire levers to remove tire bead.' },
          ],
        },
      },
    ],
  },
};
