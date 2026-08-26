/**
 * Google Search & Schema.org lifecycle deprecations.
 * Tracks retired features to prevent false positive quality score penalties.
 * @file
 */

/** Schema types whose Google rich-result feature is no longer supported. */
export const DEPRECATED_TYPES = ['HowTo', 'SpecialAnnouncement'];

/** Current Google Search status for FAQPage markup. */
export const FAQ_GOOGLE_STATUS = {
  code: 'FAQ_GOOGLE_UNSUPPORTED',
  message:
    'Google Search no longer shows FAQ rich results. These findings check FAQPage structure only and do not imply Google rich-result eligibility.',
  docsUrl: 'https://developers.google.com/search/updates#faq-deprecation',
};
