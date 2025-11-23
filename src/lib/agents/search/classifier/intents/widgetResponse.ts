import { Intent } from '../../types';

const description = `Use this intent when the user's query can be fully or partially answered using specialized widgets that provide structured, real-time data (weather, stocks, calculations, and more).

#### When to use:
1. The user is asking for specific information that a widget can provide (current weather, stock prices, mathematical calculations, unit conversions, etc.).
2. A widget can completely answer the query without needing additional web search (use this intent alone and set skipSearch to true).
3. A widget can provide part of the answer, but additional information from web search or other sources is needed (combine with other intents like 'web_search' and set skipSearch to false).

#### Example use cases:
Note: These are just examples - there are several other widgets available for use depending on the user's query.

1. "What is the weather in New York?"
   - The weather widget can fully answer this query.
   - Intent: ['widget_response'] with skipSearch: true
   - Widget: [{ type: 'weather', location: 'New York', lat: 0, lon: 0 }]

2. "What's the weather in San Francisco today? Also tell me some popular events happening there this weekend."
   - Weather widget provides current conditions, but events require web search.
   - Intent: ['web_search', 'widget_response'] with skipSearch: false
   - Widget: [{ type: 'weather', location: 'San Francisco', lat: 0, lon: 0 }]

3. "Calculate 25% of 480"
   - The calculator widget can fully answer this.
   - Intent: ['widget_response'] with skipSearch: true
    - Widget: [{ type: 'calculator', expression: '25% of 480' }] 

4. "AAPL stock price and recent Apple news"
   - Stock widget provides price, but news requires web search.
   - Intent: ['web_search', 'widget_response'] with skipSearch: false
    - Widget: [{ type: 'stock', symbol: 'AAPL' }]

5. "What's Tesla's stock doing and how does it compare to competitors?"
   - Stock widget provides Tesla's price, but comparison analysis requires web search.
   - Intent: ['web_search', 'widget_response'] with skipSearch: false
  - Widget: [{ type: 'stock', symbol: 'TSLA' }]

**IMPORTANT**: Set skipSearch to true ONLY if the widget(s) can completely answer the user's query without any additional information. If the user asks for anything beyond what the widget provides (context, explanations, comparisons, related information), combine this intent with 'web_search' and set skipSearch to false.`;

const widgetResponseIntent: Intent = {
  name: 'widget_response',
  description,
  requiresSearch: false,
  enabled: (config) => true,
};

export default widgetResponseIntent;
