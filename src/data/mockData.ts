import { Restaurant, Order } from '../types/index.ts';

export const INITIAL_RESTAURANTS: Restaurant[] = [
  {
    id: 'rest-1',
    name: 'Burger House Lekki',
    tagline: 'Gourmet smashed beef burgers & hand-cut golden fries',
    cuisine: 'Burgers & Grills',
    rating: 4.6,
    reviewCount: 320,
    deliveryTimeMin: 25,
    deliveryTimeMax: 35,
    deliveryFee: 500,
    minOrder: 2800,
    priceTier: '$$',
    address: '14 Admiralty Way, Lekki Phase 1',
    lat: 6.4474,
    lng: 3.4723,
    distanceKm: 1.8,
    tags: ['Burgers', 'Chicken', 'Fries', 'Fast Food', 'Wings'],
    badge: 'Popular',
    accentColor: '#EA580C',
    iconName: 'Burger',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-1-1',
        name: 'Gourmet Burgers',
        description: '100% prime beef patties smashed on cast iron with secret house sauce',
        items: [
          {
            id: 'item-101',
            restaurantId: 'rest-1',
            name: 'Classic Burger',
            description: 'Prime beef patty, crisp lettuce, sliced tomato, pickles, and our signature burger relish on a toasted brioche bun',
            price: 3500,
            category: 'Gourmet Burgers',
            dietary: ['Chef Special'],
            popular: true,
            calories: 650,
            prepTimeMin: 12,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-doneness',
                name: 'Patty Doneness',
                required: true,
                options: [
                  { id: 'done-well', name: 'Well Done (Standard)', price: 0 },
                  { id: 'done-med', name: 'Medium Well', price: 0 }
                ]
              },
              {
                id: 'grp-extras',
                name: 'Add Extras',
                required: false,
                options: [
                  { id: 'ex-cheese', name: 'Extra Cheddar Cheese Slice', price: 500 },
                  { id: 'ex-bacon', name: 'Crispy Beef Bacon Strips', price: 800 },
                  { id: 'ex-patty', name: 'Extra Beef Patty', price: 1500 },
                  { id: 'ex-jalapeno', name: 'Spicy Pickled Jalapeños', price: 300 }
                ]
              }
            ]
          },
          {
            id: 'item-102',
            restaurantId: 'rest-1',
            name: 'Cheese Burger',
            description: 'Double melted Wisconsin cheddar, prime beef patty, caramelized onions, house truffle mayonnaise',
            price: 4200,
            category: 'Gourmet Burgers',
            dietary: ['Chef Special'],
            popular: true,
            calories: 780,
            prepTimeMin: 14,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-cheese-type',
                name: 'Cheese Variety',
                required: false,
                options: [
                  { id: 'ch-cheddar', name: 'Sharp Cheddar', price: 0 },
                  { id: 'ch-pepperjack', name: 'Pepper Jack (Spicy)', price: 200 }
                ]
              }
            ]
          },
          {
            id: 'item-103',
            restaurantId: 'rest-1',
            name: 'Double Beef Gourmet',
            description: 'Two quarter-pound beef patties, crispy onion strings, smoked barbecue glaze, and double American cheese',
            price: 5500,
            category: 'Gourmet Burgers',
            dietary: ['Chef Special'],
            popular: false,
            calories: 950,
            prepTimeMin: 15,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-1-2',
        name: 'Sides & Finger Foods',
        description: 'Crispy accompaniments made fresh to order',
        items: [
          {
            id: 'item-104',
            restaurantId: 'rest-1',
            name: 'Crispy French Fries',
            description: 'Hand-cut Idaho potatoes tossed with rosemary sea salt and served with garlic aioli',
            price: 1500,
            category: 'Sides & Finger Foods',
            dietary: ['Vegetarian'],
            popular: true,
            calories: 380,
            prepTimeMin: 8,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-fries-size',
                name: 'Portion Size',
                required: true,
                options: [
                  { id: 'sz-regular', name: 'Regular Size', price: 0 },
                  { id: 'sz-large', name: 'Large Size (+ ₦500)', price: 500 }
                ]
              }
            ]
          },
          {
            id: 'item-105',
            restaurantId: 'rest-1',
            name: 'Loaded BBQ Wings',
            description: '6 pieces of jumbo crispy chicken wings tossed in sticky smoky hickory BBQ sauce',
            price: 3200,
            category: 'Sides & Finger Foods',
            dietary: ['Halal'],
            popular: true,
            calories: 620,
            prepTimeMin: 14,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-1-3',
        name: 'Thick Milkshakes',
        description: 'Churned with rich premium dairy ice cream',
        items: [
          {
            id: 'item-106',
            restaurantId: 'rest-1',
            name: 'Oreo Crumb Milkshake',
            description: 'Velvety vanilla bean ice cream blended with crushed Oreo cookies and whipped cream',
            price: 2200,
            category: 'Thick Milkshakes',
            dietary: ['Vegetarian'],
            popular: true,
            calories: 540,
            prepTimeMin: 5,
            isAvailable: true
          }
        ]
      }
    ]
  },
  {
    id: 'rest-2',
    name: 'Pizza Palace',
    tagline: 'Artisan hand-tossed pizzas, crispy crusts & rich toppings',
    cuisine: 'Pizza · Italian · Fast Food',
    rating: 4.5,
    reviewCount: 428,
    deliveryTimeMin: 25,
    deliveryTimeMax: 35,
    deliveryFee: 500,
    minOrder: 2700,
    priceTier: '$$',
    address: 'Plot 28 Victoria Arobieke St, Lekki Phase 1',
    lat: 6.4485,
    lng: 3.4751,
    distanceKm: 2.1,
    tags: ['Pizza', 'Italian', 'Fast Food', 'Vegetarian'],
    badge: 'Popular',
    accentColor: '#DC2626',
    iconName: 'Pizza',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-2-1',
        name: 'Signature Pizzas',
        description: '72-hour slow fermented dough baked at 450°C in our volcanic stone oven',
        items: [
          {
            id: 'item-201',
            restaurantId: 'rest-2',
            name: 'Pepperoni Passion',
            description: 'Loaded with beef pepperoni slices, rich San Marzano tomato reduction, and shredded creamy mozzarella',
            price: 6500,
            category: 'Signature Pizzas',
            dietary: ['Chef Special'],
            popular: true,
            calories: 880,
            prepTimeMin: 15,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-pizza-size',
                name: 'Crust Size',
                required: true,
                options: [
                  { id: 'pz-med', name: 'Medium 12-inch', price: 0 },
                  { id: 'pz-large', name: 'Large 14-inch (+ ₦1,500)', price: 1500 }
                ]
              },
              {
                id: 'grp-cheese-crust',
                name: 'Crust Style',
                required: false,
                options: [
                  { id: 'cr-thin', name: 'Traditional Crispy Thin', price: 0 },
                  { id: 'cr-stuffed', name: 'Cheese-Stuffed Crust (+ ₦1,000)', price: 1000 }
                ]
              }
            ]
          },
          {
            id: 'item-202',
            restaurantId: 'rest-2',
            name: 'Margherita Classica',
            description: 'San Marzano plum tomatoes, fresh buffalo mozzarella, aromatic sweet basil, extra virgin olive oil',
            price: 5200,
            category: 'Signature Pizzas',
            dietary: ['Vegetarian'],
            popular: true,
            calories: 720,
            prepTimeMin: 12,
            isAvailable: true
          },
          {
            id: 'item-203',
            restaurantId: 'rest-2',
            name: 'BBQ Chicken Supreme',
            description: 'Flame-grilled shredded chicken, sweet corn, bell peppers, red onions, tangy BBQ swirl',
            price: 7200,
            category: 'Signature Pizzas',
            dietary: ['Halal'],
            popular: false,
            calories: 890,
            prepTimeMin: 16,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-2-2',
        name: 'Starters & Bread',
        description: 'Oven-fresh garlic breads and sides',
        items: [
          {
            id: 'item-204',
            restaurantId: 'rest-2',
            name: 'Cheesy Garlic Breadsticks',
            description: 'Fresh dough brushed with roasted garlic herb butter and covered in bubbling mozzarella',
            price: 2200,
            category: 'Starters & Bread',
            dietary: ['Vegetarian'],
            popular: true,
            calories: 450,
            prepTimeMin: 10,
            isAvailable: true
          }
        ]
      }
    ]
  },
  {
    id: 'rest-3',
    name: 'The Grill Spot',
    tagline: 'Signature flame-grilled chicken, steamed rice platters & continental feasts',
    cuisine: 'Grills · Continental',
    rating: 4.7,
    reviewCount: 384,
    deliveryTimeMin: 30,
    deliveryTimeMax: 40,
    deliveryFee: 500,
    minOrder: 3200,
    priceTier: '$$',
    address: 'Plot 12 Bisola Durosinmi Etti Drive, Lekki Phase 1',
    lat: 6.4461,
    lng: 3.4712,
    distanceKm: 2.4,
    tags: ['Grills', 'Continental', 'Chicken', 'Rice'],
    badge: 'Top Rated',
    accentColor: '#16A34A',
    iconName: 'Soup',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-3-1',
        name: 'Rice Delicacies',
        description: 'Firewood smokey jollof and seasoned fried rice cooked to perfection',
        items: [
          {
            id: 'item-301',
            restaurantId: 'rest-3',
            name: 'Smokey Party Jollof & Asun',
            description: 'Rich fire-cooked firewood jollof rice served with spicy peppered goat meat (Asun), fried sweet plantain (Dodo), and coleslaw',
            price: 4800,
            category: 'Rice Delicacies',
            dietary: ['Chef Special', 'Halal'],
            popular: true,
            calories: 850,
            prepTimeMin: 14,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-protein-jollof',
                name: 'Protein Choice',
                required: true,
                options: [
                  { id: 'pr-asun', name: 'Spicy Goat Meat (Asun)', price: 0 },
                  { id: 'pr-beef', name: 'Fried Assorted Beef', price: 0 },
                  { id: 'pr-chicken', name: 'Crispy Grilled Quarter Chicken', price: 400 },
                  { id: 'pr-fish', name: 'Fried Croaker Fish', price: 1000 }
                ]
              },
              {
                id: 'grp-extra-sides',
                name: 'Extra Sides',
                required: false,
                options: [
                  { id: 'ex-dodo', name: 'Extra Portion Dodo (Plantain)', price: 800 },
                  { id: 'ex-moimoi', name: 'Rich Fish Moi Moi', price: 1200 }
                ]
              }
            ]
          },
          {
            id: 'item-302',
            restaurantId: 'rest-3',
            name: 'Special Fried Rice & Turkey',
            description: 'Fragrant basmati rice tossed with sweet carrots, peas, sweet corn, and jumbo peppered fried turkey wing',
            price: 5200,
            category: 'Rice Delicacies',
            dietary: ['Halal'],
            popular: true,
            calories: 820,
            prepTimeMin: 14,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-3-2',
        name: 'Soups & Traditional Swallow',
        description: 'Authentic local pots prepared with pure stock fish, dried crayfish, and palm oil',
        items: [
          {
            id: 'item-303',
            restaurantId: 'rest-3',
            name: 'Egusi Soup with Pounded Yam',
            description: 'Melon seed soup with bitterleaf and spinach, cooked with dried stockfish and cow leg, served with hot soft pounded yam',
            price: 5500,
            category: 'Soups & Traditional Swallow',
            dietary: ['Chef Special'],
            popular: true,
            calories: 980,
            prepTimeMin: 16,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-swallow',
                name: 'Select Swallow',
                required: true,
                options: [
                  { id: 'sw-yam', name: 'Smooth Pounded Yam', price: 0 },
                  { id: 'sw-eba', name: 'Yellow Garri Eba', price: 0 },
                  { id: 'sw-semovita', name: 'Semovita', price: 0 },
                  { id: 'sw-wheat', name: 'Whole Wheat', price: 0 }
                ]
              }
            ]
          },
          {
            id: 'item-304',
            restaurantId: 'rest-3',
            name: 'Fresh Catfish Pepper Soup',
            description: 'Hot aromatic broth brewed with alligator pepper, calabash nutmeg, and fresh point-and-kill catfish',
            price: 3800,
            category: 'Soups & Traditional Swallow',
            dietary: ['Chef Special'],
            popular: false,
            calories: 420,
            prepTimeMin: 18,
            isAvailable: true
          }
        ]
      }
    ]
  },
  {
    id: 'rest-4',
    name: 'Suya Express & Grills',
    tagline: 'Northern Nigerian open-charcoal grilled beef suya & shawarma',
    cuisine: 'Barbecue & Suya',
    rating: 4.8,
    reviewCount: 410,
    deliveryTimeMin: 20,
    deliveryTimeMax: 30,
    deliveryFee: 600,
    minOrder: 2000,
    priceTier: '$$',
    address: '69 Fola Osibo St, Lekki Phase 1',
    lat: 6.4512,
    lng: 3.4735,
    distanceKm: 1.5,
    tags: ['Suya', 'Grills', 'Shawarma', 'BBQ', 'Late Night'],
    badge: 'Top Rated',
    accentColor: '#B45309',
    iconName: 'Flame',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-4-1',
        name: 'Charcoal Suya Platters',
        description: 'Tender steak slices marinated in kuli-kuli yaji spice and grilled over charcoal',
        items: [
          {
            id: 'item-401',
            restaurantId: 'rest-4',
            name: 'Special Beef Suya Platter',
            description: 'Thinly sliced tender sirloin beef grilled over coals, topped with spicy yaji pepper, sliced red onions, and sweet plum tomatoes',
            price: 3800,
            category: 'Charcoal Suya Platters',
            dietary: ['Halal', 'Chef Special'],
            popular: true,
            calories: 520,
            prepTimeMin: 12,
            isAvailable: true,
            customizations: [
              {
                id: 'grp-spice-suya',
                name: 'Yaji Pepper Heat',
                required: true,
                options: [
                  { id: 'sp-mild', name: 'Mild Pepper', price: 0 },
                  { id: 'sp-medium', name: 'Standard Naija Heat', price: 0 },
                  { id: 'sp-extra', name: 'Extra Fiery Yaji', price: 0 }
                ]
              }
            ]
          },
          {
            id: 'item-402',
            restaurantId: 'rest-4',
            name: 'Chicken Suya with Masa',
            description: 'Deboned chicken thighs grilled and served with 3 pieces of fermented rice cakes (Masa)',
            price: 4500,
            category: 'Charcoal Suya Platters',
            dietary: ['Halal'],
            popular: true,
            calories: 640,
            prepTimeMin: 15,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-4-2',
        name: 'Street Shawarma',
        description: 'Lagos-style pita wraps packed with spiced sausages and creamy sauce',
        items: [
          {
            id: 'item-403',
            restaurantId: 'rest-4',
            name: 'Double Sausage Beef Shawarma',
            description: 'Toasted pita wrap packed with grilled beef strips, two beef sausages, cabbage slaw, and creamy spicy cream',
            price: 2800,
            category: 'Street Shawarma',
            dietary: ['Halal'],
            popular: true,
            calories: 720,
            prepTimeMin: 10,
            isAvailable: true
          }
        ]
      }
    ]
  },
  {
    id: 'rest-5',
    name: 'The Good Bowl (Healthy & Salads)',
    tagline: 'Fresh crisp salads, detox bowls, and cold-pressed juices',
    cuisine: 'Healthy & Vegan',
    rating: 4.7,
    reviewCount: 195,
    deliveryTimeMin: 20,
    deliveryTimeMax: 30,
    deliveryFee: 500,
    minOrder: 1500,
    priceTier: '$$',
    address: '22 Block 11 Omorinre Johnson St, Lekki Phase 1',
    lat: 6.4491,
    lng: 3.4698,
    distanceKm: 2.8,
    tags: ['Healthy', 'Salads', 'Smoothies', 'Vegan', 'Bowls'],
    badge: 'Healthy Choice',
    accentColor: '#059669',
    iconName: 'Leaf',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-5-1',
        name: 'Wholesome Salad Bowls',
        description: 'Nutrient-rich bowls assembled with organic locally sourced produce',
        items: [
          {
            id: 'item-501',
            restaurantId: 'rest-5',
            name: 'Grilled Chicken Caesar Salad',
            description: 'Crisp romaine lettuce, herb-grilled chicken breast, shaved parmesan, garlic croutons, and creamy Caesar vinaigrette',
            price: 4200,
            category: 'Wholesome Salad Bowls',
            dietary: ['Halal'],
            popular: true,
            calories: 460,
            prepTimeMin: 10,
            isAvailable: true
          },
          {
            id: 'item-502',
            restaurantId: 'rest-5',
            name: 'Quinoa & Avocado Glow Bowl',
            description: 'Fluffy tri-color quinoa, ripe Hass avocado, cherry tomatoes, edamame, and toasted sunflower seeds in lime tahini dressing',
            price: 4800,
            category: 'Wholesome Salad Bowls',
            dietary: ['Vegan', 'Gluten-Free'],
            popular: true,
            calories: 410,
            prepTimeMin: 8,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-5-2',
        name: 'Cold-Pressed Juices',
        description: '100% pure raw fruit and vegetable extracts with no added refined sugar',
        items: [
          {
            id: 'item-503',
            restaurantId: 'rest-5',
            name: 'Green Immunity Detox Juice',
            description: 'Fresh spinach, green apple, cucumber, celery, ginger, and lemon zest (500ml)',
            price: 2000,
            category: 'Cold-Pressed Juices',
            dietary: ['Vegan', 'Gluten-Free'],
            popular: false,
            calories: 140,
            prepTimeMin: 5,
            isAvailable: true
          }
        ]
      }
    ]
  },
  {
    id: 'rest-6',
    name: 'Tokyo Wok & Dim Sum',
    tagline: 'Sizzling Asian stir-fries, handmade dumplings & noodles',
    cuisine: 'Asian & Chinese',
    rating: 4.6,
    reviewCount: 380,
    deliveryTimeMin: 30,
    deliveryTimeMax: 40,
    deliveryFee: 700,
    minOrder: 2500,
    priceTier: '$$$',
    address: 'Plot 1043 Adeola Odeku St, Victoria Island',
    lat: 6.4281,
    lng: 3.4219,
    distanceKm: 4.2,
    tags: ['Asian', 'Dim Sum', 'Noodles', 'Fried Rice', 'Chinese'],
    badge: 'Popular',
    accentColor: '#9333EA',
    iconName: 'Soup',
    isOpen: true,
    zone: 'LAGOS',
    categories: [
      {
        id: 'cat-6-1',
        name: 'Wok Specialties',
        description: 'High-heat wok cooking with traditional soy, garlic, and scallion oils',
        items: [
          {
            id: 'item-601',
            restaurantId: 'rest-6',
            name: 'Special House Fried Rice',
            description: 'Wok-tossed jasmine rice with jumbo tiger prawns, beef strips, spring onions, and roasted sesame oil',
            price: 4500,
            category: 'Wok Specialties',
            dietary: ['Chef Special'],
            popular: true,
            calories: 740,
            prepTimeMin: 14,
            isAvailable: true
          },
          {
            id: 'item-602',
            restaurantId: 'rest-6',
            name: 'Sweet & Sour Crispy Chicken',
            description: 'Golden battered chicken pieces tossed with sweet bell peppers and pineapple in a tart glaze',
            price: 5200,
            category: 'Wok Specialties',
            dietary: ['Halal'],
            popular: true,
            calories: 690,
            prepTimeMin: 15,
            isAvailable: true
          }
        ]
      },
      {
        id: 'cat-6-2',
        name: 'Handcrafted Dim Sum',
        description: 'Steamed in traditional bamboo baskets',
        items: [
          {
            id: 'item-603',
            restaurantId: 'rest-6',
            name: 'Steamed Prawn Dumplings (Har Gow)',
            description: '4 translucent crystal dumplings filled with seasoned whole prawns, served with chili dipping oil',
            price: 3800,
            category: 'Handcrafted Dim Sum',
            dietary: ['Chef Special'],
            popular: true,
            calories: 280,
            prepTimeMin: 12,
            isAvailable: true
          }
        ]
      }
    ]
  }
];

export const INITIAL_ORDERS: Order[] = [];

