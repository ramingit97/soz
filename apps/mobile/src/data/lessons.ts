import { asBearLesson } from './bearLessons';

export interface GrammarExerciseData {
  kind: 'fill_blank' | 'order_words';
  prompt: string;
  options: string[];
  correct: string | string[];
}

export type LessonFocus = 'story_listen' | 'conversation' | 'vocab_grammar' | 'review';

export interface LessonData {
  theme: string;
  themeEmoji: string;
  /** Pedagogical focus of the day — decides the hero activity in the daily path.
   * Present for AI-generated days; absent = treat as 'vocab_grammar'. */
  focus?: LessonFocus;
  vocabulary: string[];
  story: { text: string; emoji: string }[];
  wordGame: { emoji: string; correct: string; options: string[] }[];
  /** Present for AI-generated days (31+). Static days 1-30 use grammar.tsx fallback. */
  grammar?: GrammarExerciseData[];
  talkSystemPrompt: string;
  reward: { stars: number; message: string };
  /** Present for AI-generated days — shown in parent UI. */
  reasoning?: string;
}

// ─── English lessons ─────────────────────────────────────────────────────────

const EN: Record<number, LessonData> = {
  1: {
    theme: 'Meeting Bobo',
    themeEmoji: '🤖',
    vocabulary: ['hello', 'name', 'friend', 'house', 'robot'],
    story: [
      { text: "Hi! I'm Bobo. I'm a friendly robot.", emoji: '🤖' },
      { text: "This is my house. It's a robot house!", emoji: '🏠' },
      { text: "I want to be your friend. Let's play!", emoji: '🤝' },
    ],
    wordGame: [
      { emoji: '🏠', correct: 'house', options: ['house', 'tree', 'car', 'dog'] },
      { emoji: '🤖', correct: 'robot', options: ['cat', 'robot', 'book', 'ball'] },
      { emoji: '🤝', correct: 'friend', options: ['friend', 'apple', 'chair', 'phone'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. The child is a beginner — keep sentences short (3-7 words). Today's vocabulary: hello, name, friend, house, robot. Ask the child's name, where they live, if they have a pet. Be encouraging. Never lecture about grammar.",
    reward: { stars: 12, message: "Awesome! You met Bobo and earned a lamp for his house!" },
  },

  2: {
    theme: 'Colors',
    themeEmoji: '🎨',
    vocabulary: ['red', 'blue', 'green', 'yellow', 'white'],
    story: [
      { text: "Bobo loves to paint! He has many colors.", emoji: '🎨' },
      { text: "His robot suit is blue. His hat is red!", emoji: '🔵' },
      { text: "Now Bobo's house is green and yellow. Beautiful!", emoji: '🏡' },
    ],
    wordGame: [
      { emoji: '🔴', correct: 'red', options: ['red', 'blue', 'green', 'white'] },
      { emoji: '💙', correct: 'blue', options: ['yellow', 'blue', 'red', 'green'] },
      { emoji: '💚', correct: 'green', options: ['white', 'green', 'yellow', 'blue'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: red, blue, green, yellow, white. Ask the child what their favorite color is. Ask them to describe colors of things around them. Keep sentences short and playful.",
    reward: { stars: 14, message: "Amazing! You know all the colors! Bobo painted a rainbow for you!" },
  },

  3: {
    theme: 'My Family',
    themeEmoji: '👨‍👩‍👧',
    vocabulary: ['mom', 'dad', 'sister', 'brother', 'family'],
    story: [
      { text: "Bobo has a big robot family!", emoji: '👨‍👩‍👧' },
      { text: "This is robot mom. She loves to hug.", emoji: '👩' },
      { text: "This is robot dad. He loves to build things!", emoji: '👨' },
    ],
    wordGame: [
      { emoji: '👩', correct: 'mom', options: ['mom', 'dad', 'sister', 'friend'] },
      { emoji: '👨', correct: 'dad', options: ['brother', 'dad', 'mom', 'family'] },
      { emoji: '👧', correct: 'sister', options: ['sister', 'mom', 'dad', 'brother'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: mom, dad, sister, brother, family. Ask the child about their family. Keep it warm and simple. Short sentences only.",
    reward: { stars: 14, message: "Great job! Now Bobo knows about your family!" },
  },

  4: {
    theme: 'Yummy Food',
    themeEmoji: '🍎',
    vocabulary: ['apple', 'bread', 'milk', 'cake', 'eat'],
    story: [
      { text: "Bobo is making breakfast today. Yummy!", emoji: '🍳' },
      { text: "He has an apple, some bread, and milk.", emoji: '🍎' },
      { text: "Then Bobo eats a big yummy cake! Mmm!", emoji: '🎂' },
    ],
    wordGame: [
      { emoji: '🍎', correct: 'apple', options: ['apple', 'bread', 'milk', 'cake'] },
      { emoji: '🍞', correct: 'bread', options: ['apple', 'bread', 'cake', 'eat'] },
      { emoji: '🥛', correct: 'milk', options: ['water', 'milk', 'apple', 'bread'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: apple, bread, milk, cake, eat. Ask the child what they ate for breakfast. What is their favorite food? Keep sentences very short and fun.",
    reward: { stars: 14, message: "Super! You know yummy food words! Bobo baked a cake just for you!" },
  },

  5: {
    theme: 'Animals',
    themeEmoji: '🐶',
    vocabulary: ['dog', 'cat', 'bird', 'fish', 'rabbit'],
    story: [
      { text: "Bobo visits the pet shop today!", emoji: '🐾' },
      { text: "There's a happy dog and a sleeping cat.", emoji: '🐶' },
      { text: "Bobo buys a little fish. His new pet!", emoji: '🐠' },
    ],
    wordGame: [
      { emoji: '🐶', correct: 'dog', options: ['dog', 'cat', 'bird', 'fish'] },
      { emoji: '🐱', correct: 'cat', options: ['rabbit', 'cat', 'dog', 'bird'] },
      { emoji: '🐦', correct: 'bird', options: ['fish', 'bird', 'cat', 'rabbit'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: dog, cat, bird, fish, rabbit. Ask the child if they have a pet. What animals do they like? Keep it playful and short.",
    reward: { stars: 16, message: "Wonderful! You know all the animals! Bobo got a pet fish for his house!" },
  },

  6: {
    theme: 'My Body',
    themeEmoji: '👋',
    vocabulary: ['hand', 'eye', 'nose', 'mouth', 'ear'],
    story: [
      { text: "Bobo checks all his robot parts today.", emoji: '🔧' },
      { text: "Two robot eyes, one robot nose, two robot ears.", emoji: '👁️' },
      { text: "Big robot hands and a big robot smile!", emoji: '👋' },
    ],
    wordGame: [
      { emoji: '👋', correct: 'hand', options: ['hand', 'eye', 'nose', 'mouth'] },
      { emoji: '👁️', correct: 'eye', options: ['ear', 'eye', 'hand', 'nose'] },
      { emoji: '👃', correct: 'nose', options: ['nose', 'mouth', 'eye', 'ear'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: hand, eye, nose, mouth, ear. Play a body game — say 'touch your nose!' and let them respond. Keep it physical and fun!",
    reward: { stars: 16, message: "Excellent! Bobo is clapping his robot hands for you! Well done!" },
  },

  7: {
    theme: 'Numbers 1–5',
    themeEmoji: '🔢',
    vocabulary: ['one', 'two', 'three', 'four', 'five'],
    story: [
      { text: "Bobo loves counting his lamps! One, two, three...", emoji: '🔢' },
      { text: "He has four lamps and five robot friends!", emoji: '🏮' },
      { text: "Can you count with Bobo? One! Two! Three!", emoji: '🎉' },
    ],
    wordGame: [
      { emoji: '1️⃣', correct: 'one', options: ['one', 'two', 'three', 'four'] },
      { emoji: '2️⃣', correct: 'two', options: ['five', 'two', 'one', 'three'] },
      { emoji: '3️⃣', correct: 'three', options: ['three', 'four', 'two', 'five'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: one, two, three, four, five. Count things with the child — ask: how many fingers? How old are you? Make it exciting like a game show!",
    reward: { stars: 18, message: "Hooray! You can count to five! Bobo gives you 5 golden stars!" },
  },

  8: {
    theme: 'School',
    themeEmoji: '🏫',
    vocabulary: ['school', 'teacher', 'book', 'pen', 'learn'],
    story: [
      { text: "Bobo goes to robot school today!", emoji: '🏫' },
      { text: "The teacher gives him a big book to read.", emoji: '📚' },
      { text: "Bobo writes with a pen. He loves to learn!", emoji: '✏️' },
    ],
    wordGame: [
      { emoji: '🏫', correct: 'school', options: ['school', 'home', 'park', 'shop'] },
      { emoji: '📚', correct: 'book', options: ['pen', 'book', 'teacher', 'learn'] },
      { emoji: '✏️', correct: 'pen', options: ['book', 'pen', 'school', 'chair'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: school, teacher, book, pen, learn. Ask the child about their school, favorite subject, and best teacher. Short sentences. Be curious and friendly!",
    reward: { stars: 16, message: "Brilliant! Bobo got a gold star at robot school — just like you!" },
  },

  9: {
    theme: 'My Home',
    themeEmoji: '🏠',
    vocabulary: ['kitchen', 'bedroom', 'table', 'chair', 'door'],
    story: [
      { text: "Bobo shows you his robot house inside!", emoji: '🏠' },
      { text: "There's a big table and four chairs in the kitchen.", emoji: '🍽️' },
      { text: "He sleeps in his cozy bedroom. Sweet dreams, Bobo!", emoji: '🛏️' },
    ],
    wordGame: [
      { emoji: '🍽️', correct: 'kitchen', options: ['kitchen', 'bedroom', 'door', 'table'] },
      { emoji: '🛏️', correct: 'bedroom', options: ['chair', 'bedroom', 'kitchen', 'door'] },
      { emoji: '🚪', correct: 'door', options: ['door', 'table', 'chair', 'kitchen'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: kitchen, bedroom, table, chair, door. Ask the child to describe their home — what is in their kitchen? Where do they sleep? Use simple questions.",
    reward: { stars: 16, message: "Great work! Bobo added a new room to his robot house!" },
  },

  10: {
    theme: 'Getting Dressed',
    themeEmoji: '👕',
    vocabulary: ['shirt', 'shoes', 'hat', 'dress', 'jacket'],
    story: [
      { text: "Bobo is getting dressed for a big day!", emoji: '👕' },
      { text: "He puts on his blue shirt and red hat.", emoji: '👒' },
      { text: "Then a warm jacket — now he's ready!", emoji: '🧥' },
    ],
    wordGame: [
      { emoji: '👕', correct: 'shirt', options: ['shirt', 'shoes', 'hat', 'dress'] },
      { emoji: '👟', correct: 'shoes', options: ['jacket', 'shoes', 'shirt', 'hat'] },
      { emoji: '🧢', correct: 'hat', options: ['dress', 'hat', 'shoes', 'jacket'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: shirt, shoes, hat, dress, jacket. Ask what the child is wearing today. What is their favorite piece of clothing? Keep it fun and light!",
    reward: { stars: 16, message: "Stylish! Bobo is wearing his best outfit to celebrate you!" },
  },

  11: {
    theme: 'Weather',
    themeEmoji: '☀️',
    vocabulary: ['sun', 'rain', 'snow', 'wind', 'cloud'],
    story: [
      { text: "Bobo looks outside. What is the weather today?", emoji: '🌤️' },
      { text: "Yesterday there was rain and strong wind!", emoji: '🌧️' },
      { text: "Today the sun is out. Time to play!", emoji: '☀️' },
    ],
    wordGame: [
      { emoji: '☀️', correct: 'sun', options: ['sun', 'rain', 'snow', 'wind'] },
      { emoji: '🌧️', correct: 'rain', options: ['cloud', 'rain', 'sun', 'snow'] },
      { emoji: '❄️', correct: 'snow', options: ['snow', 'wind', 'rain', 'cloud'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: sun, rain, snow, wind, cloud. Ask about the weather outside right now. Do they like snow or sun more? What do they do on rainy days?",
    reward: { stars: 16, message: "Wonderful! The sun is shining just for you today, champion!" },
  },

  12: {
    theme: 'Transport',
    themeEmoji: '🚗',
    vocabulary: ['car', 'bus', 'train', 'plane', 'bike'],
    story: [
      { text: "Bobo wants to travel the world!", emoji: '🌍' },
      { text: "First by bus, then by train, then by plane!", emoji: '✈️' },
      { text: "At home he rides his little bike. Zoom!", emoji: '🚲' },
    ],
    wordGame: [
      { emoji: '🚗', correct: 'car', options: ['car', 'bus', 'train', 'bike'] },
      { emoji: '🚌', correct: 'bus', options: ['plane', 'bus', 'car', 'train'] },
      { emoji: '✈️', correct: 'plane', options: ['plane', 'bike', 'bus', 'car'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: car, bus, train, plane, bike. Ask how the child gets to school. Have they been on a plane? What is their favorite way to travel?",
    reward: { stars: 18, message: "Fantastic traveller! Bobo is flying his robot plane in your honour!" },
  },

  13: {
    theme: 'Time of Day',
    themeEmoji: '⏰',
    vocabulary: ['morning', 'afternoon', 'evening', 'night', 'today'],
    story: [
      { text: "Bobo has a busy day planned!", emoji: '⏰' },
      { text: "In the morning he reads. In the afternoon he plays.", emoji: '📖' },
      { text: "In the evening he eats. At night he sleeps. Zzz!", emoji: '🌙' },
    ],
    wordGame: [
      { emoji: '🌅', correct: 'morning', options: ['morning', 'evening', 'night', 'today'] },
      { emoji: '🌙', correct: 'night', options: ['afternoon', 'night', 'morning', 'evening'] },
      { emoji: '🌇', correct: 'evening', options: ['evening', 'today', 'night', 'morning'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: morning, afternoon, evening, night, today. Ask what the child does in the morning. What time do they wake up? What do they do in the evening?",
    reward: { stars: 16, message: "Well done! You know all the parts of the day. Bobo made you a clock!" },
  },

  14: {
    theme: 'Fruits',
    themeEmoji: '🍊',
    vocabulary: ['orange', 'banana', 'grapes', 'carrot', 'tomato'],
    story: [
      { text: "Bobo goes to the market. So many fruits!", emoji: '🛒' },
      { text: "He picks a yellow banana and sweet grapes.", emoji: '🍇' },
      { text: "Bobo also buys a carrot and red tomato. Healthy!", emoji: '🥕' },
    ],
    wordGame: [
      { emoji: '🍊', correct: 'orange', options: ['orange', 'banana', 'grapes', 'carrot'] },
      { emoji: '🍌', correct: 'banana', options: ['tomato', 'banana', 'orange', 'grapes'] },
      { emoji: '🍇', correct: 'grapes', options: ['grapes', 'carrot', 'banana', 'orange'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: orange, banana, grapes, carrot, tomato. Ask what fruits the child likes. Do they eat vegetables? What is their favourite healthy food?",
    reward: { stars: 16, message: "Super healthy! Bobo is eating a banana to celebrate your progress!" },
  },

  15: {
    theme: 'Nature',
    themeEmoji: '🌳',
    vocabulary: ['tree', 'flower', 'river', 'forest', 'sky'],
    story: [
      { text: "Bobo goes for a walk in the forest!", emoji: '🌳' },
      { text: "He sees beautiful flowers by the river.", emoji: '🌸' },
      { text: "The sky is blue and birds fly high above.", emoji: '🌤️' },
    ],
    wordGame: [
      { emoji: '🌳', correct: 'tree', options: ['tree', 'flower', 'river', 'sky'] },
      { emoji: '🌸', correct: 'flower', options: ['forest', 'flower', 'tree', 'river'] },
      { emoji: '🏞️', correct: 'river', options: ['river', 'sky', 'flower', 'tree'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: tree, flower, river, forest, sky. Ask if the child likes nature. Do they have trees near their home? What is their favourite outdoor place?",
    reward: { stars: 18, message: "Beautiful! Bobo planted a tree in his garden just for you!" },
  },

  16: {
    theme: 'Sports',
    themeEmoji: '⚽',
    vocabulary: ['run', 'jump', 'swim', 'kick', 'ball'],
    story: [
      { text: "Bobo loves sports! He runs every morning.", emoji: '🏃' },
      { text: "He jumps high and kicks the football.", emoji: '⚽' },
      { text: "On hot days Bobo swims in the river!", emoji: '🏊' },
    ],
    wordGame: [
      { emoji: '🏃', correct: 'run', options: ['run', 'jump', 'swim', 'kick'] },
      { emoji: '🦘', correct: 'jump', options: ['ball', 'jump', 'run', 'swim'] },
      { emoji: '🏊', correct: 'swim', options: ['swim', 'kick', 'jump', 'run'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: run, jump, swim, kick, ball. Ask what sport the child likes. Can they swim? Do they play football? Be energetic and enthusiastic!",
    reward: { stars: 18, message: "Champion! Bobo is doing a victory lap just for you!" },
  },

  17: {
    theme: 'Music & Art',
    themeEmoji: '🎵',
    vocabulary: ['sing', 'dance', 'draw', 'music', 'paint'],
    story: [
      { text: "Bobo loves art! He draws and paints all day.", emoji: '🎨' },
      { text: "He also loves music — he sings and dances!", emoji: '🎵' },
      { text: "His robot house is full of beautiful art.", emoji: '🖼️' },
    ],
    wordGame: [
      { emoji: '🎤', correct: 'sing', options: ['sing', 'dance', 'draw', 'paint'] },
      { emoji: '💃', correct: 'dance', options: ['music', 'dance', 'sing', 'draw'] },
      { emoji: '✏️', correct: 'draw', options: ['draw', 'paint', 'dance', 'music'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: sing, dance, draw, music, paint. Ask if the child likes music. Can they sing or dance? Do they draw or paint? What kind of music do they like?",
    reward: { stars: 18, message: "Artistic genius! Bobo hung your portrait in his gallery!" },
  },

  18: {
    theme: 'Feelings',
    themeEmoji: '😊',
    vocabulary: ['happy', 'sad', 'angry', 'scared', 'excited'],
    story: [
      { text: "Bobo has many feelings every day!", emoji: '😊' },
      { text: "He is happy when friends visit him.", emoji: '😄' },
      { text: "He gets excited when he learns something new!", emoji: '🤩' },
    ],
    wordGame: [
      { emoji: '😄', correct: 'happy', options: ['happy', 'sad', 'angry', 'scared'] },
      { emoji: '😢', correct: 'sad', options: ['excited', 'sad', 'happy', 'angry'] },
      { emoji: '😠', correct: 'angry', options: ['angry', 'scared', 'sad', 'excited'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: happy, sad, angry, scared, excited. Ask how the child is feeling today. What makes them happy? What makes them scared? Be warm and supportive.",
    reward: { stars: 18, message: "Bobo is SO excited for you! You are doing wonderfully!" },
  },

  19: {
    theme: 'Health',
    themeEmoji: '🏥',
    vocabulary: ['sick', 'doctor', 'medicine', 'sleep', 'better'],
    story: [
      { text: "Oh no! Bobo feels sick today.", emoji: '🤒' },
      { text: "The robot doctor gives him medicine.", emoji: '💊' },
      { text: "After some sleep, Bobo feels much better!", emoji: '😊' },
    ],
    wordGame: [
      { emoji: '🤒', correct: 'sick', options: ['sick', 'doctor', 'sleep', 'better'] },
      { emoji: '👨‍⚕️', correct: 'doctor', options: ['medicine', 'doctor', 'sick', 'sleep'] },
      { emoji: '💊', correct: 'medicine', options: ['medicine', 'better', 'doctor', 'sick'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: sick, doctor, medicine, sleep, better. Ask when the child last felt sick. Do they go to the doctor? What helps them feel better? Be caring and gentle.",
    reward: { stars: 18, message: "Stay healthy! Bobo made you some robot soup to keep you strong!" },
  },

  20: {
    theme: 'Jobs',
    themeEmoji: '👩‍🍳',
    vocabulary: ['teacher', 'doctor', 'cook', 'pilot', 'artist'],
    story: [
      { text: "Bobo wonders: what job will he have one day?", emoji: '🤔' },
      { text: "Maybe a pilot flying planes? Or a cook making food?", emoji: '✈️' },
      { text: "Bobo decides — he wants to be a teacher!", emoji: '👨‍🏫' },
    ],
    wordGame: [
      { emoji: '👩‍🍳', correct: 'cook', options: ['cook', 'pilot', 'doctor', 'teacher'] },
      { emoji: '✈️', correct: 'pilot', options: ['artist', 'pilot', 'cook', 'doctor'] },
      { emoji: '🎨', correct: 'artist', options: ['artist', 'teacher', 'pilot', 'cook'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: teacher, doctor, cook, pilot, artist. Ask what job the child wants when they grow up. What does their mom or dad do? What is the coolest job?",
    reward: { stars: 18, message: "Dream big! Whatever you become, Bobo will be your biggest fan!" },
  },

  21: {
    theme: 'City & Places',
    themeEmoji: '🏙️',
    vocabulary: ['park', 'shop', 'library', 'café', 'hospital'],
    story: [
      { text: "Bobo explores the city today.", emoji: '🏙️' },
      { text: "He reads books in the library, then drinks in a café.", emoji: '📚' },
      { text: "After, he plays in the park. What a great day!", emoji: '🌳' },
    ],
    wordGame: [
      { emoji: '🌳', correct: 'park', options: ['park', 'shop', 'café', 'library'] },
      { emoji: '🛒', correct: 'shop', options: ['hospital', 'shop', 'park', 'café'] },
      { emoji: '📚', correct: 'library', options: ['library', 'café', 'shop', 'hospital'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: park, shop, library, café, hospital. Ask what places the child visits often. Do they like going to the park? Have they been to a library?",
    reward: { stars: 20, message: "City explorer! Bobo put your name on the city map!" },
  },

  22: {
    theme: 'Seasons',
    themeEmoji: '🍂',
    vocabulary: ['spring', 'summer', 'autumn', 'winter', 'season'],
    story: [
      { text: "Bobo loves all four seasons!", emoji: '🌍' },
      { text: "Spring has flowers, summer has sunshine!", emoji: '🌸' },
      { text: "Autumn has golden leaves, winter has snow!", emoji: '❄️' },
    ],
    wordGame: [
      { emoji: '🌸', correct: 'spring', options: ['spring', 'summer', 'autumn', 'winter'] },
      { emoji: '☀️', correct: 'summer', options: ['winter', 'summer', 'spring', 'season'] },
      { emoji: '❄️', correct: 'winter', options: ['autumn', 'winter', 'summer', 'spring'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: spring, summer, autumn, winter, season. Ask which season the child likes most and why. What activities do they do in different seasons?",
    reward: { stars: 20, message: "All-seasons champion! Bobo built you a four-season garden!" },
  },

  23: {
    theme: 'Numbers 6–10',
    themeEmoji: '🔟',
    vocabulary: ['six', 'seven', 'eight', 'nine', 'ten'],
    story: [
      { text: "Bobo's friends come to visit! Six, seven, eight...", emoji: '🤖' },
      { text: "Nine robot friends, then TEN! It's a party!", emoji: '🎉' },
      { text: "They eat ten cakes and sing ten songs!", emoji: '🎂' },
    ],
    wordGame: [
      { emoji: '6️⃣', correct: 'six', options: ['six', 'seven', 'eight', 'nine'] },
      { emoji: '8️⃣', correct: 'eight', options: ['ten', 'eight', 'six', 'seven'] },
      { emoji: '🔟', correct: 'ten', options: ['ten', 'nine', 'eight', 'seven'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: six, seven, eight, nine, ten. Count things together — how many rooms in your house? How many people in your family? Count up to 10 together!",
    reward: { stars: 20, message: "Perfect score! You can count all the way to TEN!" },
  },

  24: {
    theme: 'Ocean',
    themeEmoji: '🌊',
    vocabulary: ['sea', 'beach', 'wave', 'sand', 'shell'],
    story: [
      { text: "Bobo visits the sea for the first time!", emoji: '🌊' },
      { text: "He walks on the warm sand and finds a shell.", emoji: '🐚' },
      { text: "Big waves splash him. Bobo laughs and jumps!", emoji: '😄' },
    ],
    wordGame: [
      { emoji: '🌊', correct: 'sea', options: ['sea', 'beach', 'wave', 'sand'] },
      { emoji: '🏖️', correct: 'beach', options: ['shell', 'beach', 'sea', 'wave'] },
      { emoji: '🐚', correct: 'shell', options: ['shell', 'sand', 'beach', 'wave'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: sea, beach, wave, sand, shell. Ask if the child has been to the sea. What do they do at the beach? Do they like swimming in the ocean?",
    reward: { stars: 20, message: "Beach hero! Bobo found a special shell with your name on it!" },
  },

  25: {
    theme: 'Technology',
    themeEmoji: '💻',
    vocabulary: ['phone', 'computer', 'game', 'video', 'screen'],
    story: [
      { text: "Bobo loves technology — he's a robot after all!", emoji: '🤖' },
      { text: "He has a computer, a phone, and loves video games!", emoji: '💻' },
      { text: "But his favourite screen is the one with YOU!", emoji: '📱' },
    ],
    wordGame: [
      { emoji: '📱', correct: 'phone', options: ['phone', 'computer', 'game', 'screen'] },
      { emoji: '💻', correct: 'computer', options: ['video', 'computer', 'phone', 'game'] },
      { emoji: '🎮', correct: 'game', options: ['game', 'screen', 'computer', 'phone'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: phone, computer, game, video, screen. Ask what games the child likes to play. Do they use a computer? What is their favourite app or video?",
    reward: { stars: 20, message: "Tech genius! Bobo upgraded his robot brain just for you!" },
  },

  26: {
    theme: 'Hobbies',
    themeEmoji: '🎯',
    vocabulary: ['read', 'cook', 'collect', 'build', 'hobby'],
    story: [
      { text: "What does Bobo do in his free time?", emoji: '🎯' },
      { text: "He loves to build things and collect shells.", emoji: '🔨' },
      { text: "He also cooks and reads. So many hobbies!", emoji: '📖' },
    ],
    wordGame: [
      { emoji: '📖', correct: 'read', options: ['read', 'cook', 'build', 'collect'] },
      { emoji: '🍳', correct: 'cook', options: ['hobby', 'cook', 'read', 'build'] },
      { emoji: '🔨', correct: 'build', options: ['build', 'collect', 'cook', 'read'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: read, cook, collect, build, hobby. Ask what hobbies the child has. Do they collect anything? Can they cook? What do they build or create?",
    reward: { stars: 20, message: "Creative star! Bobo is inspired by all your amazing hobbies!" },
  },

  27: {
    theme: 'Days of the Week',
    themeEmoji: '📅',
    vocabulary: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    story: [
      { text: "Bobo has a plan for every day of the week!", emoji: '📅' },
      { text: "Monday to Friday he studies hard at school.", emoji: '🏫' },
      { text: "Wednesday is his favourite — art class day!", emoji: '🎨' },
    ],
    wordGame: [
      { emoji: '1️⃣📅', correct: 'Monday', options: ['Monday', 'Tuesday', 'Friday', 'Thursday'] },
      { emoji: '3️⃣📅', correct: 'Wednesday', options: ['Tuesday', 'Wednesday', 'Monday', 'Friday'] },
      { emoji: '5️⃣📅', correct: 'Friday', options: ['Thursday', 'Friday', 'Wednesday', 'Tuesday'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: Monday, Tuesday, Wednesday, Thursday, Friday. Ask what the child does each day of the week. What is their favourite day? What do they do on Friday?",
    reward: { stars: 20, message: "Week master! Bobo made you a personal robot calendar!" },
  },

  28: {
    theme: 'Opposites',
    themeEmoji: '🔄',
    vocabulary: ['big', 'small', 'fast', 'slow', 'new'],
    story: [
      { text: "Bobo loves opposites — they are so fun!", emoji: '🔄' },
      { text: "He has a big robot friend and a small one.", emoji: '🤖' },
      { text: "The big one is slow, the small one is fast!", emoji: '⚡' },
    ],
    wordGame: [
      { emoji: '🐘', correct: 'big', options: ['big', 'small', 'fast', 'slow'] },
      { emoji: '🐭', correct: 'small', options: ['new', 'small', 'big', 'fast'] },
      { emoji: '⚡', correct: 'fast', options: ['fast', 'slow', 'small', 'new'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: big, small, fast, slow, new. Play an opposites game — say 'big' and the child says 'small'. Ask: are you fast or slow? Is your bag big or small?",
    reward: { stars: 22, message: "Opposite genius! Bobo is both BIG and small when he dances!" },
  },

  29: {
    theme: 'Kindness',
    themeEmoji: '💛',
    vocabulary: ['kind', 'help', 'share', 'love', 'together'],
    story: [
      { text: "Bobo believes kindness makes the world better!", emoji: '💛' },
      { text: "He helps friends and loves to share his food.", emoji: '🤝' },
      { text: "Together they are stronger! Bobo loves you!", emoji: '❤️' },
    ],
    wordGame: [
      { emoji: '💛', correct: 'kind', options: ['kind', 'help', 'share', 'love'] },
      { emoji: '🤝', correct: 'help', options: ['together', 'help', 'kind', 'share'] },
      { emoji: '❤️', correct: 'love', options: ['love', 'share', 'help', 'kind'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. Today's vocabulary: kind, help, share, love, together. Ask how the child shows kindness. Do they help at home? Who do they love? Talk about friendship and caring.",
    reward: { stars: 24, message: "You have a golden heart! Bobo loves you and is so proud of you!" },
  },

  30: {
    theme: 'Celebration!',
    themeEmoji: '🏆',
    vocabulary: ['champion', 'amazing', 'celebrate', 'thank you', 'goodbye'],
    story: [
      { text: "30 days! You are a true English champion!", emoji: '🏆' },
      { text: "Bobo says: THANK YOU for every lesson together!", emoji: '🙏' },
      { text: "This is not goodbye — it's a new beginning!", emoji: '🚀' },
    ],
    wordGame: [
      { emoji: '🏆', correct: 'champion', options: ['champion', 'amazing', 'goodbye', 'celebrate'] },
      { emoji: '🙏', correct: 'thank you', options: ['celebrate', 'thank you', 'champion', 'amazing'] },
      { emoji: '🎉', correct: 'celebrate', options: ['celebrate', 'goodbye', 'thank you', 'amazing'] },
    ],
    talkSystemPrompt:
      "You are Bobo, a friendly robot speaking ONLY in English. This is the final lesson! Celebrate with the child. Ask what their favourite lesson was. What new word do they love most? Tell them how proud you are. Make it special!",
    reward: { stars: 30, message: "YOU DID IT! 30 days of English! Bobo is your biggest fan forever!" },
  },
};

// ─── Russian lessons ─────────────────────────────────────────────────────────

const RU: Record<number, LessonData> = {
  1: {
    theme: 'Знакомство с Бобо',
    themeEmoji: '🤖',
    vocabulary: ['привет', 'имя', 'друг', 'дом', 'робот'],
    story: [
      { text: 'Привет! Я Бобо. Я добрый робот.', emoji: '🤖' },
      { text: 'Это мой дом. Это дом робота!', emoji: '🏠' },
      { text: 'Я хочу быть твоим другом. Давай играть!', emoji: '🤝' },
    ],
    wordGame: [
      { emoji: '🏠', correct: 'дом', options: ['дом', 'дерево', 'машина', 'собака'] },
      { emoji: '🤖', correct: 'робот', options: ['кот', 'робот', 'книга', 'мяч'] },
      { emoji: '🤝', correct: 'друг', options: ['друг', 'яблоко', 'стул', 'телефон'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: привет, имя, друг, дом, робот. Спроси как зовут, где живёт, есть ли питомец. Поощряй. Не объясняй грамматику — просто беседуй. Предложения 3-7 слов.',
    reward: { stars: 12, message: 'Отлично! Ты познакомился с Бобо и получил лампу для его дома!' },
  },

  2: {
    theme: 'Цвета',
    themeEmoji: '🎨',
    vocabulary: ['красный', 'синий', 'зелёный', 'жёлтый', 'белый'],
    story: [
      { text: 'Бобо любит рисовать! У него много красок.', emoji: '🎨' },
      { text: 'Его костюм синий, а шляпа красная!', emoji: '🔵' },
      { text: 'Теперь его дом зелёный и жёлтый. Красиво!', emoji: '🏡' },
    ],
    wordGame: [
      { emoji: '🔴', correct: 'красный', options: ['красный', 'синий', 'зелёный', 'белый'] },
      { emoji: '💙', correct: 'синий', options: ['жёлтый', 'синий', 'красный', 'зелёный'] },
      { emoji: '💚', correct: 'зелёный', options: ['белый', 'зелёный', 'жёлтый', 'синий'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: красный, синий, зелёный, жёлтый, белый. Спроси какой любимый цвет. Попроси описать цвета вещей вокруг. Короткие весёлые предложения.',
    reward: { stars: 14, message: 'Замечательно! Ты знаешь все цвета! Бобо нарисовал радугу специально для тебя!' },
  },

  3: {
    theme: 'Моя семья',
    themeEmoji: '👨‍👩‍👧',
    vocabulary: ['мама', 'папа', 'сестра', 'брат', 'семья'],
    story: [
      { text: 'У Бобо большая семья роботов!', emoji: '👨‍👩‍👧' },
      { text: 'Это мама-робот. Она очень любит обнимать.', emoji: '👩' },
      { text: 'Это папа-робот. Он любит всё строить!', emoji: '👨' },
    ],
    wordGame: [
      { emoji: '👩', correct: 'мама', options: ['мама', 'папа', 'сестра', 'друг'] },
      { emoji: '👨', correct: 'папа', options: ['брат', 'папа', 'мама', 'семья'] },
      { emoji: '👧', correct: 'сестра', options: ['сестра', 'мама', 'папа', 'брат'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: мама, папа, сестра, брат, семья. Спроси о семье ребёнка. Тепло и просто. Только короткие предложения.',
    reward: { stars: 14, message: 'Отлично! Теперь Бобо знает твою семью! Он сделал семейное фото для тебя!' },
  },

  4: {
    theme: 'Вкусная еда',
    themeEmoji: '🍎',
    vocabulary: ['яблоко', 'хлеб', 'молоко', 'торт', 'есть'],
    story: [
      { text: 'Бобо готовит завтрак сегодня. Как вкусно!', emoji: '🍳' },
      { text: 'У него яблоко, хлеб и молоко.', emoji: '🍎' },
      { text: 'А потом Бобо съел большой вкусный торт! Ммм!', emoji: '🎂' },
    ],
    wordGame: [
      { emoji: '🍎', correct: 'яблоко', options: ['яблоко', 'хлеб', 'молоко', 'торт'] },
      { emoji: '🍞', correct: 'хлеб', options: ['яблоко', 'хлеб', 'торт', 'есть'] },
      { emoji: '🥛', correct: 'молоко', options: ['вода', 'молоко', 'яблоко', 'хлеб'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: яблоко, хлеб, молоко, торт, есть. Спроси что ел на завтрак. Какая любимая еда? Короткие весёлые предложения.',
    reward: { stars: 14, message: 'Супер! Ты знаешь вкусные слова! Бобо испёк торт специально для тебя!' },
  },

  5: {
    theme: 'Животные',
    themeEmoji: '🐶',
    vocabulary: ['собака', 'кошка', 'птица', 'рыба', 'кролик'],
    story: [
      { text: 'Бобо идёт в зоомагазин сегодня!', emoji: '🐾' },
      { text: 'Там весёлая собака и спящая кошка.', emoji: '🐶' },
      { text: 'Бобо купил маленькую рыбку. Его новый питомец!', emoji: '🐠' },
    ],
    wordGame: [
      { emoji: '🐶', correct: 'собака', options: ['собака', 'кошка', 'птица', 'рыба'] },
      { emoji: '🐱', correct: 'кошка', options: ['кролик', 'кошка', 'собака', 'птица'] },
      { emoji: '🐦', correct: 'птица', options: ['рыба', 'птица', 'кошка', 'кролик'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: собака, кошка, птица, рыба, кролик. Спроси есть ли питомец. Каких животных любит? Весело и коротко.',
    reward: { stars: 16, message: 'Замечательно! Ты знаешь всех животных! Бобо завёл рыбку для своего дома!' },
  },

  6: {
    theme: 'Моё тело',
    themeEmoji: '👋',
    vocabulary: ['рука', 'глаз', 'нос', 'рот', 'ухо'],
    story: [
      { text: 'Бобо проверяет все детали своего тела.', emoji: '🔧' },
      { text: 'Два глаза-робота, один нос, два уха.', emoji: '👁️' },
      { text: 'Большие руки и большая улыбка!', emoji: '👋' },
    ],
    wordGame: [
      { emoji: '👋', correct: 'рука', options: ['рука', 'глаз', 'нос', 'рот'] },
      { emoji: '👁️', correct: 'глаз', options: ['ухо', 'глаз', 'рука', 'нос'] },
      { emoji: '👃', correct: 'нос', options: ['нос', 'рот', 'глаз', 'ухо'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: рука, глаз, нос, рот, ухо. Поиграй с ребёнком — говори «потрогай нос!» и жди ответа. Весело и активно!',
    reward: { stars: 16, message: 'Отлично! Бобо хлопает своими роботскими руками за тебя!' },
  },

  7: {
    theme: 'Числа 1–5',
    themeEmoji: '🔢',
    vocabulary: ['один', 'два', 'три', 'четыре', 'пять'],
    story: [
      { text: 'Бобо любит считать свои лампочки!', emoji: '🔢' },
      { text: 'У него четыре лампочки и пять друзей-роботов!', emoji: '🏮' },
      { text: 'Считай с Бобо! Один! Два! Три!', emoji: '🎉' },
    ],
    wordGame: [
      { emoji: '1️⃣', correct: 'один', options: ['один', 'два', 'три', 'четыре'] },
      { emoji: '2️⃣', correct: 'два', options: ['пять', 'два', 'один', 'три'] },
      { emoji: '3️⃣', correct: 'три', options: ['три', 'четыре', 'два', 'пять'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: один, два, три, четыре, пять. Считай предметы вместе с ребёнком. Как в игровом шоу — весело!',
    reward: { stars: 18, message: 'Ура! Ты умеешь считать до пяти! Бобо даёт тебе 5 золотых звёзд!' },
  },

  8: {
    theme: 'Школа',
    themeEmoji: '🏫',
    vocabulary: ['школа', 'учитель', 'книга', 'ручка', 'учиться'],
    story: [
      { text: 'Бобо идёт в школу роботов сегодня!', emoji: '🏫' },
      { text: 'Учитель даёт ему большую книгу.', emoji: '📚' },
      { text: 'Бобо пишет ручкой. Он любит учиться!', emoji: '✏️' },
    ],
    wordGame: [
      { emoji: '🏫', correct: 'школа', options: ['школа', 'дом', 'парк', 'магазин'] },
      { emoji: '📚', correct: 'книга', options: ['ручка', 'книга', 'учитель', 'стол'] },
      { emoji: '✏️', correct: 'ручка', options: ['книга', 'ручка', 'школа', 'стул'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: школа, учитель, книга, ручка, учиться. Спроси о школе ребёнка, любимом предмете, лучшем учителе. Короткие предложения.',
    reward: { stars: 16, message: 'Отличник! Бобо получил золотую звезду в школе роботов — как ты!' },
  },

  9: {
    theme: 'Мой дом',
    themeEmoji: '🏠',
    vocabulary: ['кухня', 'спальня', 'стол', 'стул', 'дверь'],
    story: [
      { text: 'Бобо показывает свой дом изнутри!', emoji: '🏠' },
      { text: 'На кухне стоит большой стол и четыре стула.', emoji: '🍽️' },
      { text: 'Он спит в уютной спальне. Спокойной ночи!', emoji: '🛏️' },
    ],
    wordGame: [
      { emoji: '🍽️', correct: 'кухня', options: ['кухня', 'спальня', 'дверь', 'стол'] },
      { emoji: '🛏️', correct: 'спальня', options: ['стул', 'спальня', 'кухня', 'дверь'] },
      { emoji: '🚪', correct: 'дверь', options: ['дверь', 'стол', 'стул', 'кухня'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: кухня, спальня, стол, стул, дверь. Спроси про дом ребёнка — что есть на кухне? Где спит? Простые вопросы.',
    reward: { stars: 16, message: 'Отлично! Бобо добавил новую комнату в свой дом!' },
  },

  10: {
    theme: 'Одежда',
    themeEmoji: '👕',
    vocabulary: ['рубашка', 'туфли', 'шляпа', 'платье', 'куртка'],
    story: [
      { text: 'Бобо одевается на важный день!', emoji: '👕' },
      { text: 'Он надевает синюю рубашку и красную шляпу.', emoji: '👒' },
      { text: 'Потом тёплую куртку — теперь готов!', emoji: '🧥' },
    ],
    wordGame: [
      { emoji: '👕', correct: 'рубашка', options: ['рубашка', 'туфли', 'шляпа', 'платье'] },
      { emoji: '👟', correct: 'туфли', options: ['куртка', 'туфли', 'рубашка', 'шляпа'] },
      { emoji: '🧢', correct: 'шляпа', options: ['платье', 'шляпа', 'туфли', 'куртка'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: рубашка, туфли, шляпа, платье, куртка. Спроси что ребёнок сейчас надет. Какая любимая одежда? Весело и легко!',
    reward: { stars: 16, message: 'Стильно! Бобо надел лучший наряд, чтобы отпраздновать твой успех!' },
  },

  11: {
    theme: 'Погода',
    themeEmoji: '☀️',
    vocabulary: ['солнце', 'дождь', 'снег', 'ветер', 'облако'],
    story: [
      { text: 'Бобо смотрит в окно. Какая погода?', emoji: '🌤️' },
      { text: 'Вчера был дождь и сильный ветер!', emoji: '🌧️' },
      { text: 'Сегодня светит солнце. Пора гулять!', emoji: '☀️' },
    ],
    wordGame: [
      { emoji: '☀️', correct: 'солнце', options: ['солнце', 'дождь', 'снег', 'ветер'] },
      { emoji: '🌧️', correct: 'дождь', options: ['облако', 'дождь', 'солнце', 'снег'] },
      { emoji: '❄️', correct: 'снег', options: ['снег', 'ветер', 'дождь', 'облако'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: солнце, дождь, снег, ветер, облако. Спроси какая погода сейчас. Снег или солнце — что больше нравится? Что делают в дождливый день?',
    reward: { stars: 16, message: 'Замечательно! Сегодня солнце светит специально для тебя, чемпион!' },
  },

  12: {
    theme: 'Транспорт',
    themeEmoji: '🚗',
    vocabulary: ['машина', 'автобус', 'поезд', 'самолёт', 'велосипед'],
    story: [
      { text: 'Бобо хочет путешествовать по всему миру!', emoji: '🌍' },
      { text: 'Сначала на автобусе, потом на поезде, потом на самолёте!', emoji: '✈️' },
      { text: 'Дома он ездит на маленьком велосипеде. Вжух!', emoji: '🚲' },
    ],
    wordGame: [
      { emoji: '🚗', correct: 'машина', options: ['машина', 'автобус', 'поезд', 'велосипед'] },
      { emoji: '🚌', correct: 'автобус', options: ['самолёт', 'автобус', 'машина', 'поезд'] },
      { emoji: '✈️', correct: 'самолёт', options: ['самолёт', 'велосипед', 'автобус', 'машина'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: машина, автобус, поезд, самолёт, велосипед. Спроси как добирается до школы. Летал ли на самолёте? Любимый транспорт?',
    reward: { stars: 18, message: 'Путешественник! Бобо летит на роботском самолёте в твою честь!' },
  },

  13: {
    theme: 'Время суток',
    themeEmoji: '⏰',
    vocabulary: ['утро', 'день', 'вечер', 'ночь', 'сегодня'],
    story: [
      { text: 'У Бобо насыщенный день впереди!', emoji: '⏰' },
      { text: 'Утром читает, днём играет.', emoji: '📖' },
      { text: 'Вечером ест. Ночью спит. Zzz!', emoji: '🌙' },
    ],
    wordGame: [
      { emoji: '🌅', correct: 'утро', options: ['утро', 'вечер', 'ночь', 'сегодня'] },
      { emoji: '🌙', correct: 'ночь', options: ['день', 'ночь', 'утро', 'вечер'] },
      { emoji: '🌇', correct: 'вечер', options: ['вечер', 'сегодня', 'ночь', 'утро'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: утро, день, вечер, ночь, сегодня. Спроси что делает ребёнок утром. Во сколько встаёт? Что делает вечером?',
    reward: { stars: 16, message: 'Молодец! Ты знаешь все части дня. Бобо сделал тебе часы!' },
  },

  14: {
    theme: 'Фрукты',
    themeEmoji: '🍊',
    vocabulary: ['апельсин', 'банан', 'виноград', 'морковь', 'помидор'],
    story: [
      { text: 'Бобо идёт на рынок. Столько фруктов!', emoji: '🛒' },
      { text: 'Он берёт жёлтый банан и сладкий виноград.', emoji: '🍇' },
      { text: 'Бобо покупает ещё морковь и красный помидор!', emoji: '🥕' },
    ],
    wordGame: [
      { emoji: '🍊', correct: 'апельсин', options: ['апельсин', 'банан', 'виноград', 'морковь'] },
      { emoji: '🍌', correct: 'банан', options: ['помидор', 'банан', 'апельсин', 'виноград'] },
      { emoji: '🍇', correct: 'виноград', options: ['виноград', 'морковь', 'банан', 'апельсин'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: апельсин, банан, виноград, морковь, помидор. Спроси какие фрукты нравятся. Едят ли овощи? Самая любимая полезная еда?',
    reward: { stars: 16, message: 'Очень полезно! Бобо ест банан, чтобы отметить твой прогресс!' },
  },

  15: {
    theme: 'Природа',
    themeEmoji: '🌳',
    vocabulary: ['дерево', 'цветок', 'река', 'лес', 'небо'],
    story: [
      { text: 'Бобо идёт на прогулку в лес!', emoji: '🌳' },
      { text: 'Он видит красивые цветы у реки.', emoji: '🌸' },
      { text: 'Небо голубое, птицы летят высоко!', emoji: '🌤️' },
    ],
    wordGame: [
      { emoji: '🌳', correct: 'дерево', options: ['дерево', 'цветок', 'река', 'небо'] },
      { emoji: '🌸', correct: 'цветок', options: ['лес', 'цветок', 'дерево', 'река'] },
      { emoji: '🏞️', correct: 'река', options: ['река', 'небо', 'цветок', 'дерево'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: дерево, цветок, река, лес, небо. Спроси нравится ли природа. Есть ли деревья рядом с домом? Любимое место на свежем воздухе?',
    reward: { stars: 18, message: 'Прекрасно! Бобо посадил дерево в своём саду специально для тебя!' },
  },

  16: {
    theme: 'Спорт',
    themeEmoji: '⚽',
    vocabulary: ['бегать', 'прыгать', 'плавать', 'пинать', 'мяч'],
    story: [
      { text: 'Бобо любит спорт! Он бегает каждое утро.', emoji: '🏃' },
      { text: 'Он прыгает высоко и пинает футбольный мяч.', emoji: '⚽' },
      { text: 'В жаркий день Бобо плавает в реке!', emoji: '🏊' },
    ],
    wordGame: [
      { emoji: '🏃', correct: 'бегать', options: ['бегать', 'прыгать', 'плавать', 'пинать'] },
      { emoji: '🦘', correct: 'прыгать', options: ['мяч', 'прыгать', 'бегать', 'плавать'] },
      { emoji: '🏊', correct: 'плавать', options: ['плавать', 'пинать', 'прыгать', 'бегать'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: бегать, прыгать, плавать, пинать, мяч. Спроси какой спорт нравится. Умеет ли плавать? Играет ли в футбол? Будь энергичным!',
    reward: { stars: 18, message: 'Чемпион! Бобо делает круг почёта специально для тебя!' },
  },

  17: {
    theme: 'Музыка и искусство',
    themeEmoji: '🎵',
    vocabulary: ['петь', 'танцевать', 'рисовать', 'музыка', 'краски'],
    story: [
      { text: 'Бобо любит искусство — он рисует весь день.', emoji: '🎨' },
      { text: 'Он также любит музыку — поёт и танцует!', emoji: '🎵' },
      { text: 'Его дом полон красивых картин.', emoji: '🖼️' },
    ],
    wordGame: [
      { emoji: '🎤', correct: 'петь', options: ['петь', 'танцевать', 'рисовать', 'краски'] },
      { emoji: '💃', correct: 'танцевать', options: ['музыка', 'танцевать', 'петь', 'рисовать'] },
      { emoji: '✏️', correct: 'рисовать', options: ['рисовать', 'краски', 'танцевать', 'музыка'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: петь, танцевать, рисовать, музыка, краски. Спроси нравится ли музыка. Умеет ли петь или танцевать? Рисует ли?',
    reward: { stars: 18, message: 'Творческий гений! Бобо повесил твой портрет в свою галерею!' },
  },

  18: {
    theme: 'Чувства',
    themeEmoji: '😊',
    vocabulary: ['радостный', 'грустный', 'злой', 'испуганный', 'взволнованный'],
    story: [
      { text: 'У Бобо много разных чувств каждый день!', emoji: '😊' },
      { text: 'Он радостный, когда к нему приходят друзья.', emoji: '😄' },
      { text: 'Он взволнованный, когда узнаёт что-то новое!', emoji: '🤩' },
    ],
    wordGame: [
      { emoji: '😄', correct: 'радостный', options: ['радостный', 'грустный', 'злой', 'испуганный'] },
      { emoji: '😢', correct: 'грустный', options: ['взволнованный', 'грустный', 'радостный', 'злой'] },
      { emoji: '😠', correct: 'злой', options: ['злой', 'испуганный', 'грустный', 'взволнованный'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: радостный, грустный, злой, испуганный, взволнованный. Спроси как ребёнок себя чувствует. Что делает радостным? Чего боится?',
    reward: { stars: 18, message: 'Бобо очень взволнован за тебя! Ты делаешь всё замечательно!' },
  },

  19: {
    theme: 'Здоровье',
    themeEmoji: '🏥',
    vocabulary: ['больной', 'доктор', 'лекарство', 'спать', 'лучше'],
    story: [
      { text: 'Ой нет! Бобо заболел сегодня.', emoji: '🤒' },
      { text: 'Доктор-робот даёт ему лекарство.', emoji: '💊' },
      { text: 'После сна Бобо чувствует себя намного лучше!', emoji: '😊' },
    ],
    wordGame: [
      { emoji: '🤒', correct: 'больной', options: ['больной', 'доктор', 'спать', 'лучше'] },
      { emoji: '👨‍⚕️', correct: 'доктор', options: ['лекарство', 'доктор', 'больной', 'спать'] },
      { emoji: '💊', correct: 'лекарство', options: ['лекарство', 'лучше', 'доктор', 'больной'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: больной, доктор, лекарство, спать, лучше. Спроси когда последний раз болел. Ходит ли к доктору? Что помогает поправиться?',
    reward: { stars: 18, message: 'Будь здоров! Бобо приготовил тебе роботский суп для сил!' },
  },

  20: {
    theme: 'Профессии',
    themeEmoji: '👩‍🍳',
    vocabulary: ['учитель', 'доктор', 'повар', 'пилот', 'художник'],
    story: [
      { text: 'Бобо думает: какая профессия будет у него?', emoji: '🤔' },
      { text: 'Может, пилот на самолёте? Или повар?', emoji: '✈️' },
      { text: 'Бобо решает — хочет стать учителем!', emoji: '👨‍🏫' },
    ],
    wordGame: [
      { emoji: '👩‍🍳', correct: 'повар', options: ['повар', 'пилот', 'доктор', 'учитель'] },
      { emoji: '✈️', correct: 'пилот', options: ['художник', 'пилот', 'повар', 'доктор'] },
      { emoji: '🎨', correct: 'художник', options: ['художник', 'учитель', 'пилот', 'повар'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: учитель, доктор, повар, пилот, художник. Спроси кем хочет стать ребёнок. Кем работают мама или папа? Самая крутая профессия?',
    reward: { stars: 18, message: 'Мечтай по-крупному! Бобо будет твоим самым большим болельщиком!' },
  },

  21: {
    theme: 'Город и места',
    themeEmoji: '🏙️',
    vocabulary: ['парк', 'магазин', 'библиотека', 'кафе', 'больница'],
    story: [
      { text: 'Бобо исследует город сегодня.', emoji: '🏙️' },
      { text: 'Он читает книги в библиотеке, потом пьёт в кафе.', emoji: '📚' },
      { text: 'После гуляет в парке. Отличный день!', emoji: '🌳' },
    ],
    wordGame: [
      { emoji: '🌳', correct: 'парк', options: ['парк', 'магазин', 'кафе', 'библиотека'] },
      { emoji: '🛒', correct: 'магазин', options: ['больница', 'магазин', 'парк', 'кафе'] },
      { emoji: '📚', correct: 'библиотека', options: ['библиотека', 'кафе', 'магазин', 'больница'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: парк, магазин, библиотека, кафе, больница. Какие места часто посещает? Любит ли ходить в парк? Бывал ли в библиотеке?',
    reward: { stars: 20, message: 'Исследователь города! Бобо написал твоё имя на карте города!' },
  },

  22: {
    theme: 'Времена года',
    themeEmoji: '🍂',
    vocabulary: ['весна', 'лето', 'осень', 'зима', 'сезон'],
    story: [
      { text: 'Бобо любит все четыре времени года!', emoji: '🌍' },
      { text: 'Весна — цветы, лето — солнышко!', emoji: '🌸' },
      { text: 'Осень — золотые листья, зима — снег!', emoji: '❄️' },
    ],
    wordGame: [
      { emoji: '🌸', correct: 'весна', options: ['весна', 'лето', 'осень', 'зима'] },
      { emoji: '☀️', correct: 'лето', options: ['зима', 'лето', 'весна', 'сезон'] },
      { emoji: '❄️', correct: 'зима', options: ['осень', 'зима', 'лето', 'весна'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: весна, лето, осень, зима, сезон. Спроси какое любимое время года и почему. Чем занимаются в разные сезоны?',
    reward: { stars: 20, message: 'Чемпион всех сезонов! Бобо построил тебе четырёхсезонный сад!' },
  },

  23: {
    theme: 'Числа 6–10',
    themeEmoji: '🔟',
    vocabulary: ['шесть', 'семь', 'восемь', 'девять', 'десять'],
    story: [
      { text: 'Друзья Бобо приходят в гости! Шесть, семь, восемь...', emoji: '🤖' },
      { text: 'Девять роботов, потом ДЕСЯТЬ! Это вечеринка!', emoji: '🎉' },
      { text: 'Они едят десять тортов и поют десять песен!', emoji: '🎂' },
    ],
    wordGame: [
      { emoji: '6️⃣', correct: 'шесть', options: ['шесть', 'семь', 'восемь', 'девять'] },
      { emoji: '8️⃣', correct: 'восемь', options: ['десять', 'восемь', 'шесть', 'семь'] },
      { emoji: '🔟', correct: 'десять', options: ['десять', 'девять', 'восемь', 'семь'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: шесть, семь, восемь, девять, десять. Считайте вещи вместе — сколько комнат в доме? Сколько людей в семье? Считайте до 10!',
    reward: { stars: 20, message: 'Идеальный результат! Ты умеешь считать до ДЕСЯТИ!' },
  },

  24: {
    theme: 'Океан',
    themeEmoji: '🌊',
    vocabulary: ['море', 'пляж', 'волна', 'песок', 'ракушка'],
    story: [
      { text: 'Бобо первый раз видит море!', emoji: '🌊' },
      { text: 'Он ходит по тёплому песку и находит ракушку.', emoji: '🐚' },
      { text: 'Большие волны брызгают на него. Бобо смеётся!', emoji: '😄' },
    ],
    wordGame: [
      { emoji: '🌊', correct: 'море', options: ['море', 'пляж', 'волна', 'песок'] },
      { emoji: '🏖️', correct: 'пляж', options: ['ракушка', 'пляж', 'море', 'волна'] },
      { emoji: '🐚', correct: 'ракушка', options: ['ракушка', 'песок', 'пляж', 'волна'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: море, пляж, волна, песок, ракушка. Спроси был ли у моря. Что делают на пляже? Любит ли плавать в море?',
    reward: { stars: 20, message: 'Герой пляжа! Бобо нашёл ракушку с твоим именем!' },
  },

  25: {
    theme: 'Технологии',
    themeEmoji: '💻',
    vocabulary: ['телефон', 'компьютер', 'игра', 'видео', 'экран'],
    story: [
      { text: 'Бобо любит технологии — он ведь робот!', emoji: '🤖' },
      { text: 'У него компьютер, телефон и любимые видеоигры!', emoji: '💻' },
      { text: 'Но любимый экран — тот, где находишься ТЫ!', emoji: '📱' },
    ],
    wordGame: [
      { emoji: '📱', correct: 'телефон', options: ['телефон', 'компьютер', 'игра', 'экран'] },
      { emoji: '💻', correct: 'компьютер', options: ['видео', 'компьютер', 'телефон', 'игра'] },
      { emoji: '🎮', correct: 'игра', options: ['игра', 'экран', 'компьютер', 'телефон'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: телефон, компьютер, игра, видео, экран. Спроси в какие игры играет. Есть ли компьютер? Любимое приложение или видео?',
    reward: { stars: 20, message: 'Технический гений! Бобо обновил свой робо-мозг специально для тебя!' },
  },

  26: {
    theme: 'Хобби',
    themeEmoji: '🎯',
    vocabulary: ['читать', 'готовить', 'коллекционировать', 'строить', 'хобби'],
    story: [
      { text: 'Чем Бобо занимается в свободное время?', emoji: '🎯' },
      { text: 'Он любит строить вещи и коллекционировать ракушки.', emoji: '🔨' },
      { text: 'Ещё готовит и читает. Столько хобби!', emoji: '📖' },
    ],
    wordGame: [
      { emoji: '📖', correct: 'читать', options: ['читать', 'готовить', 'строить', 'коллекционировать'] },
      { emoji: '🍳', correct: 'готовить', options: ['хобби', 'готовить', 'читать', 'строить'] },
      { emoji: '🔨', correct: 'строить', options: ['строить', 'коллекционировать', 'готовить', 'читать'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: читать, готовить, коллекционировать, строить, хобби. Спроси какое хобби у ребёнка. Что-то коллекционирует? Умеет готовить?',
    reward: { stars: 20, message: 'Творческая звезда! Бобо вдохновлён твоими хобби!' },
  },

  27: {
    theme: 'Дни недели',
    themeEmoji: '📅',
    vocabulary: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'],
    story: [
      { text: 'У Бобо есть план на каждый день недели!', emoji: '📅' },
      { text: 'С понедельника по пятницу он усердно учится.', emoji: '🏫' },
      { text: 'Среда — его любимый день — урок рисования!', emoji: '🎨' },
    ],
    wordGame: [
      { emoji: '1️⃣📅', correct: 'понедельник', options: ['понедельник', 'вторник', 'пятница', 'четверг'] },
      { emoji: '3️⃣📅', correct: 'среда', options: ['вторник', 'среда', 'понедельник', 'пятница'] },
      { emoji: '5️⃣📅', correct: 'пятница', options: ['четверг', 'пятница', 'среда', 'вторник'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: понедельник, вторник, среда, четверг, пятница. Спроси что делает ребёнок каждый день недели. Любимый день? Что делает в пятницу?',
    reward: { stars: 20, message: 'Мастер недели! Бобо сделал тебе личный роботский календарь!' },
  },

  28: {
    theme: 'Противоположности',
    themeEmoji: '🔄',
    vocabulary: ['большой', 'маленький', 'быстрый', 'медленный', 'новый'],
    story: [
      { text: 'Бобо любит противоположности — это так весело!', emoji: '🔄' },
      { text: 'У него большой робот-друг и маленький.', emoji: '🤖' },
      { text: 'Большой медленный, маленький быстрый!', emoji: '⚡' },
    ],
    wordGame: [
      { emoji: '🐘', correct: 'большой', options: ['большой', 'маленький', 'быстрый', 'медленный'] },
      { emoji: '🐭', correct: 'маленький', options: ['новый', 'маленький', 'большой', 'быстрый'] },
      { emoji: '⚡', correct: 'быстрый', options: ['быстрый', 'медленный', 'маленький', 'новый'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: большой, маленький, быстрый, медленный, новый. Поиграй в противоположности — ты говоришь «большой», ребёнок говорит «маленький»!',
    reward: { stars: 22, message: 'Гений противоположностей! Бобо и большой, и маленький, когда танцует!' },
  },

  29: {
    theme: 'Доброта',
    themeEmoji: '💛',
    vocabulary: ['добрый', 'помогать', 'делиться', 'любовь', 'вместе'],
    story: [
      { text: 'Бобо считает, что доброта делает мир лучше!', emoji: '💛' },
      { text: 'Он помогает друзьям и делится едой.', emoji: '🤝' },
      { text: 'Вместе они сильнее! Бобо любит тебя!', emoji: '❤️' },
    ],
    wordGame: [
      { emoji: '💛', correct: 'добрый', options: ['добрый', 'помогать', 'делиться', 'любовь'] },
      { emoji: '🤝', correct: 'помогать', options: ['вместе', 'помогать', 'добрый', 'делиться'] },
      { emoji: '❤️', correct: 'любовь', options: ['любовь', 'делиться', 'помогать', 'добрый'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Слова урока: добрый, помогать, делиться, любовь, вместе. Спроси как ребёнок проявляет доброту. Помогает ли дома? Кого любит? Говори о дружбе и заботе.',
    reward: { stars: 24, message: 'У тебя золотое сердце! Бобо любит тебя и очень тобой гордится!' },
  },

  30: {
    theme: 'Праздник!',
    themeEmoji: '🏆',
    vocabulary: ['чемпион', 'потрясающий', 'праздновать', 'спасибо', 'до свидания'],
    story: [
      { text: '30 дней! Ты настоящий чемпион!', emoji: '🏆' },
      { text: 'Бобо говорит: СПАСИБО за каждый урок вместе!', emoji: '🙏' },
      { text: 'Это не прощание — это новое начало!', emoji: '🚀' },
    ],
    wordGame: [
      { emoji: '🏆', correct: 'чемпион', options: ['чемпион', 'потрясающий', 'до свидания', 'праздновать'] },
      { emoji: '🙏', correct: 'спасибо', options: ['праздновать', 'спасибо', 'чемпион', 'потрясающий'] },
      { emoji: '🎉', correct: 'праздновать', options: ['праздновать', 'до свидания', 'спасибо', 'потрясающий'] },
    ],
    talkSystemPrompt:
      'Ты — Бобо, дружелюбный робот, общаешься ТОЛЬКО на русском языке. Это финальный урок! Отпразднуй вместе с ребёнком. Спроси какой урок был любимым. Какое новое слово он любит больше всего? Скажи как ты им гордишься!',
    reward: { stars: 30, message: 'ТЫ СДЕЛАЛ ЭТО! 30 дней уроков! Бобо — твой самый большой фанат навсегда!' },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const LESSONS: Record<string, Record<number, LessonData>> = { en: EN, ru: RU };

/** Last day of hand-crafted curriculum. Days 31+ are AI-generated per child. */
export const STATIC_MAX_DAY = 30;

/** Legacy alias — kept so existing imports still work. */
export const MAX_DAY = STATIC_MAX_DAY;

/**
 * Hook for resolving AI-generated lessons (day > 30). Set once at app startup
 * by hydrateLessonCache. Keeps this module free of mobile-specific deps.
 */
let resolveAiLesson: ((lang: string, day: number) => LessonData | null) | null = null;

/**
 * Hook for resolving curriculum lessons (days 1-30). Reads from the local
 * cache populated by services/curriculum.ts. Lets static days be DB-driven
 * (and personalized per child profile) while keeping this module dep-free.
 */
let resolveCurriculumLesson: ((lang: string, day: number) => LessonData | null) | null = null;

export function setAiLessonResolver(
  resolver: (lang: string, day: number) => LessonData | null,
): void {
  resolveAiLesson = resolver;
}

export function setCurriculumLessonResolver(
  resolver: (lang: string, day: number) => LessonData | null,
): void {
  resolveCurriculumLesson = resolver;
}

/**
 * Hook returning the child's chosen companion (pet) name. Bundled + AI lesson
 * content is authored with the default name "Bobo"; we swap in the kid's name
 * at read time so the whole app uses it. Set once at startup, dep-free here.
 */
let companionNameProvider: (() => string | null | undefined) | null = null;

export function setCompanionNameProvider(fn: () => string | null | undefined): void {
  companionNameProvider = fn;
}

/** Медвежонок или робот у текущего профиля — для встроенных уроков про персонажа. */
let companionKindProvider: (() => 'bear' | 'robot') | null = null;

export function setCompanionKindProvider(fn: () => 'bear' | 'robot'): void {
  companionKindProvider = fn;
}

/** Deep-replace the default companion name with the child's pet name across all
 * displayed lesson text (theme, story, prompt, quiz, reward). */
function renameCompanion(lesson: LessonData, name: string): LessonData {
  // JSON round-trip is the simplest deep replace; escape the name so quotes /
  // backslashes in a typed pet name can't break the JSON string.
  const safe = JSON.stringify(name).slice(1, -1);
  return JSON.parse(JSON.stringify(lesson).replace(/Bobo|Бобо/g, safe)) as LessonData;
}

export function getLesson(lang: string, day: number): LessonData | null {
  let lesson: LessonData | null;
  if (day <= STATIC_MAX_DAY) {
    // Try the personalized curriculum first; fall back to bundled defaults
    // (offline-safety / no-auth / pre-cache cases).
    const planned = resolveCurriculumLesson?.(lang, day) ?? null;
    lesson = planned ?? LESSONS[lang]?.[day] ?? null;
    // Встроенные уроки написаны про робота; малышам их пересказываем про
    // медвежонка. План с сервера уже написан под персонажа ребёнка.
    if (!planned && lesson && companionKindProvider?.() === 'bear') lesson = asBearLesson(lesson, lang);
  } else {
    lesson = resolveAiLesson ? resolveAiLesson(lang, day) : null;
  }
  if (!lesson) return null;
  const name = companionNameProvider?.()?.trim();
  return name && name !== 'Bobo' ? renameCompanion(lesson, name) : lesson;
}

export function getLessonThemes(
  lang: string,
): { day: number; theme: string; emoji: string; ai: boolean }[] {
  const langLessons = LESSONS[lang] ?? {};
  const out: { day: number; theme: string; emoji: string; ai: boolean }[] = [];
  for (let day = 1; day <= STATIC_MAX_DAY; day++) {
    // AI curriculum first — the path must show the child's real plan, not the
    // bundled template it no longer follows. Bundled = offline/pre-cache fallback.
    const ai = resolveCurriculumLesson?.(lang, day);
    const l = ai ?? langLessons[day];
    if (!l) continue;
    out.push({ day, theme: l.theme, emoji: l.themeEmoji, ai: !!ai });
  }
  return out;
}
