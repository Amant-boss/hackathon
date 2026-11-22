// menuData.js — DEMONSTRATION menu used to seed the local database.
// This is sample data, NOT verified restaurant inventory. Every allergen entry is
// marked verified:false until the kitchen confirms it. Coca-Cola deliberately has no
// allergen data (unknown), and Burrata Salad is unavailable, to exercise those states.
// Prices are integer cents. Photos are placeholder Unsplash URLs I could not verify;
// the app shows a fallback plate if one fails to load. Replace image_url per product.

const IMG = {
  starters: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=900&q=75',
  mains: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=75',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=75',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=75',
  salads: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=75',
  desserts: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=75',
  drinks: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=75',
};

// One photo per dish. Paste an image URL (https://...) next to each name.
// Any dish left as '' falls back to its category photo above.
const IMAGE_BY_NAME = {
  'Bruschetta Classica': 'https://images.unsplash.com/photo-1630230596557-ad07b433f5c0?auto=format&fit=crop&w=900&q=75',
  'Creamy Mushroom Soup': 'https://images.unsplash.com/photo-1636044994100-5728ed506526?auto=format&fit=crop&w=900&q=75',
  'Garlic Bread': 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=900&q=75',
  'Burrata Salad': 'https://plus.unsplash.com/premium_photo-1672242676660-923c3bd446d7?auto=format&fit=crop&w=900&q=75',
  'Grilled Ribeye Steak': 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?auto=format&fit=crop&w=900&q=75',
  'Chicken Parmesan': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=75',
  'Grilled Salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=75',
  'Beef Tenderloin': 'https://images.unsplash.com/photo-1723893905879-0e309c2a8e06?auto=format&fit=crop&w=900&q=75',
  'Truffle Cream Pasta': 'https://images.unsplash.com/photo-1601556123240-462c758a50db?auto=format&fit=crop&w=900&q=75',
  'Spaghetti Carbonara': 'https://plus.unsplash.com/premium_photo-1664478291780-0c67f5fb15e6?auto=format&fit=crop&w=900&q=75',
  'Penne Arrabbiata': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=75',
  'Lasagna Classica': 'https://plus.unsplash.com/premium_photo-1671559021023-3da68c12aeed?auto=format&fit=crop&w=900&q=75',
  'Margherita': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=75',
  'Pepperoni': 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=900&q=75',
  'Quattro Formaggi': 'https://plus.unsplash.com/premium_photo-1661762555601-47d088a26b50?auto=format&fit=crop&w=900&q=75',
  'Prosciutto e Rucola': 'https://images.unsplash.com/photo-1731703698022-2bcf47d3d09b?auto=format&fit=crop&w=900&q=75',
  'Caesar Salad': 'https://images.unsplash.com/photo-1782839577893-da9383e55c96?auto=format&fit=crop&w=900&q=75',
  'Mediterranean Salad': 'https://images.unsplash.com/photo-1608032077018-c9aad9565d29?auto=format&fit=crop&w=900&q=75',
  'Greek Salad': 'https://images.unsplash.com/photo-1607532941433-304659e8198a?auto=format&fit=crop&w=900&q=75',
  'Tiramisu': 'https://images.unsplash.com/photo-1766232333746-b0a2697d6d0d?auto=format&fit=crop&w=900&q=75',
  'Chocolate Fondant': 'https://images.unsplash.com/photo-1617305855058-336d24456869?auto=format&fit=crop&w=900&q=75',
  'Classic Cheesecake': 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=900&q=75',
  'Fresh Orange Juice': 'https://plus.unsplash.com/premium_photo-1667543228378-ec4478ab2845?auto=format&fit=crop&w=900&q=75',
  'Sparkling Water': 'https://images.unsplash.com/photo-1612375066516-11d6d394bd2a?auto=format&fit=crop&w=900&q=75',
  'Still Water': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=900&q=75',
  'Coca-Cola': 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=900&q=75',
};

export const SEED_CATEGORIES = [
  ['starters', 'Starters', 'Small plates to begin'],
  ['mains', 'Main Courses', 'Grilled and roasted favourites'],
  ['pasta', 'Pasta', 'Fresh and classic pasta'],
  ['pizza', 'Pizza', 'Stone-baked pizza'],
  ['salads', 'Salads', 'Fresh and light'],
  ['seafood', 'Seafood', 'From the sea'],
  ['desserts', 'Desserts', 'Something sweet'],
  ['drinks', 'Drinks', 'Cold drinks and water'],
  ['coffee', 'Coffee', 'Coffee and hot drinks'],
];

const p = (cat, name, cents, description, ingredients, contains, mayContain, dietary, prep, extra = {}) => ({
  cat, name, cents, description, ingredients,
  allergenInfo: { verified: false, contains, mayContain },
  dietary, prep, image: IMAGE_BY_NAME[name] || IMG[cat], featured: false, available: true, ...extra,
});

export const SEED_PRODUCTS = [
  p('starters', 'Bruschetta Classica', 650, 'Grilled ciabatta with ripe tomato, basil and extra virgin olive oil.', ['Ciabatta', 'Tomato', 'Basil', 'Garlic', 'Olive oil', 'Sea salt'], ['gluten'], ['sesame'], ['vegan'], 8),
  p('starters', 'Creamy Mushroom Soup', 590, 'Slow-cooked mushrooms with cream, thyme and a hint of garlic.', ['Mushrooms', 'Cream', 'Onion', 'Garlic', 'Vegetable stock', 'Thyme'], ['milk', 'celery'], ['gluten'], ['vegetarian'], 10),
  p('starters', 'Garlic Bread', 450, 'Warm baguette with garlic butter and fresh parsley.', ['Baguette', 'Butter', 'Garlic', 'Parsley'], ['gluten', 'milk'], [], ['vegetarian'], 7),
  p('starters', 'Burrata Salad', 890, 'Creamy burrata with tomatoes, rocket and aged balsamic.', ['Burrata', 'Tomatoes', 'Rocket', 'Basil', 'Olive oil', 'Balsamic vinegar'], ['milk', 'sulphites'], [], ['vegetarian', 'gluten_free'], 8),

  p('mains', 'Grilled Ribeye Steak', 2290, 'Chargrilled ribeye with rosemary garlic butter and roasted potatoes.', ['Ribeye', 'Rosemary', 'Garlic', 'Butter', 'Potatoes', 'Sea salt'], ['milk'], [], ['gluten_free'], 25),
  p('mains', 'Chicken Parmesan', 1590, 'Crisp breaded chicken with tomato sauce, mozzarella and parmesan.', ['Chicken breast', 'Breadcrumbs', 'Tomato sauce', 'Mozzarella', 'Parmesan', 'Basil'], ['gluten', 'eggs', 'milk'], ['celery'], [], 20),
  p('mains', 'Grilled Salmon', 1950, 'Salmon fillet with lemon, dill and seasonal vegetables.', ['Salmon', 'Lemon', 'Dill', 'Olive oil', 'Seasonal vegetables'], ['fish'], [], ['gluten_free', 'dairy_free'], 18),
  p('mains', 'Beef Tenderloin', 2490, 'Tender beef fillet with red wine jus, mashed potato and green beans.', ['Beef tenderloin', 'Red wine jus', 'Potatoes', 'Butter', 'Green beans'], ['milk', 'sulphites', 'celery'], ['mustard'], [], 25),

  p('pasta', 'Truffle Cream Pasta', 1490, 'Freshly prepared pasta with a delicate truffle cream sauce and aged parmesan.', ['Fresh pasta', 'Cream', 'Parmesan', 'Truffle', 'Olive oil'], ['gluten', 'milk'], ['eggs', 'celery'], [], 15, { featured: true }),
  p('pasta', 'Spaghetti Carbonara', 1250, 'Spaghetti with egg, pecorino, cured pork and black pepper.', ['Spaghetti', 'Eggs', 'Guanciale', 'Pecorino', 'Black pepper'], ['gluten', 'eggs', 'milk'], [], [], 15),
  p('pasta', 'Penne Arrabbiata', 1090, 'Penne in a spicy tomato and garlic sauce with fresh parsley.', ['Penne', 'Tomato', 'Garlic', 'Chilli', 'Parsley', 'Olive oil'], ['gluten'], [], ['vegan', 'spicy'], 14),
  p('pasta', 'Lasagna Classica', 1390, 'Layers of pasta, beef ragù, béchamel and parmesan, baked golden.', ['Pasta sheets', 'Beef ragù', 'Béchamel', 'Parmesan', 'Tomato'], ['gluten', 'eggs', 'milk', 'celery'], [], [], 20),

  p('pizza', 'Margherita', 990, 'Tomato, mozzarella and fresh basil on a thin stone-baked base.', ['Pizza dough', 'Tomato', 'Mozzarella', 'Basil', 'Olive oil'], ['gluten', 'milk'], [], ['vegetarian'], 14),
  p('pizza', 'Pepperoni', 1250, 'Spicy pepperoni, tomato and mozzarella.', ['Pizza dough', 'Tomato', 'Mozzarella', 'Pepperoni'], ['gluten', 'milk'], ['sulphites'], ['spicy'], 14),
  p('pizza', 'Quattro Formaggi', 1390, 'Mozzarella, gorgonzola, parmesan and fontina.', ['Pizza dough', 'Mozzarella', 'Gorgonzola', 'Parmesan', 'Fontina'], ['gluten', 'milk'], [], [], 14),
  p('pizza', 'Prosciutto e Rucola', 1450, 'Tomato and mozzarella topped with prosciutto, rocket and parmesan.', ['Pizza dough', 'Tomato', 'Mozzarella', 'Prosciutto', 'Rocket', 'Parmesan'], ['gluten', 'milk'], [], [], 15),

  p('salads', 'Caesar Salad', 990, 'Crisp romaine, croutons and parmesan with a classic Caesar dressing.', ['Romaine lettuce', 'Croutons', 'Parmesan', 'Caesar dressing', 'Anchovy'], ['gluten', 'eggs', 'fish', 'milk', 'mustard'], [], [], 8),
  p('salads', 'Mediterranean Salad', 890, 'Mixed leaves, tomato, cucumber, olives and feta with olive oil.', ['Mixed leaves', 'Tomato', 'Cucumber', 'Olives', 'Red onion', 'Feta', 'Olive oil'], ['milk'], [], ['vegetarian', 'gluten_free'], 7),
  p('salads', 'Greek Salad', 950, 'Tomato, cucumber, olives and feta with oregano.', ['Tomato', 'Cucumber', 'Red onion', 'Olives', 'Feta', 'Oregano', 'Olive oil'], ['milk'], [], ['vegetarian', 'gluten_free'], 7),

  p('desserts', 'Tiramisu', 650, 'Mascarpone cream and espresso-soaked ladyfingers dusted with cocoa.', ['Mascarpone', 'Ladyfingers', 'Espresso', 'Eggs', 'Cocoa'], ['gluten', 'eggs', 'milk'], [], ['vegetarian'], 5),
  p('desserts', 'Chocolate Fondant', 750, 'Warm dark chocolate cake with a soft molten centre.', ['Dark chocolate', 'Butter', 'Eggs', 'Sugar', 'Flour'], ['gluten', 'eggs', 'milk', 'soybeans'], ['tree_nuts', 'peanuts'], ['vegetarian'], 14),
  p('desserts', 'Classic Cheesecake', 690, 'Creamy baked cheesecake on a buttery biscuit base.', ['Cream cheese', 'Biscuit base', 'Butter', 'Eggs', 'Sugar', 'Vanilla'], ['gluten', 'eggs', 'milk'], ['soybeans'], ['vegetarian'], 5),

  p('drinks', 'Fresh Orange Juice', 400, 'Freshly squeezed oranges.', ['Oranges'], [], [], ['vegan', 'gluten_free', 'dairy_free'], 3),
  p('drinks', 'Sparkling Water', 250, 'Chilled sparkling mineral water.', ['Sparkling water'], [], [], ['vegan', 'gluten_free', 'dairy_free'], 1),
  p('drinks', 'Still Water', 200, 'Chilled still mineral water.', ['Still water'], [], [], ['vegan', 'gluten_free', 'dairy_free'], 1),
  p('drinks', 'Coca-Cola', 300, 'Classic cola served chilled.', ['Carbonated water', 'Sugar', 'Colour', 'Flavourings'], [], [], [], 1, { allergenInfo: null }),
];