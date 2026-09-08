import type { GrammarExerciseData } from './lessons';

// Grammar quest exercises per language per day. Days 1-30 (static curriculum).
// AI-generated days (31+) carry their grammar inside the lesson template.
export const STATIC_GRAMMAR: Record<string, Record<number, GrammarExerciseData[]>> = {
  en: {
    1: [
      {
        kind: 'fill_blank',
        prompt: 'I ___ a robot.',
        options: ['am', 'is', 'are', 'be'],
        correct: 'am',
      },
      {
        kind: 'order_words',
        prompt: 'Build the sentence:',
        options: ['name', 'My', 'is', 'Bobo'],
        correct: ['My', 'name', 'is', 'Bobo'],
      },
    ],
    2: [
      {
        kind: 'fill_blank',
        prompt: 'The sky ___ blue.',
        options: ['is', 'am', 'are', 'be'],
        correct: 'is',
      },
      {
        kind: 'fill_blank',
        prompt: 'My hat ___ red.',
        options: ['is', 'are', 'am', 'be'],
        correct: 'is',
      },
    ],
    3: [
      {
        kind: 'fill_blank',
        prompt: 'She ___ my mom.',
        options: ['is', 'am', 'are', 'be'],
        correct: 'is',
      },
      {
        kind: 'order_words',
        prompt: 'Build the sentence:',
        options: ['have', 'I', 'brother', 'a'],
        correct: ['I', 'have', 'a', 'brother'],
      },
    ],
    4: [
      {
        kind: 'fill_blank',
        prompt: 'I ___ an apple.',
        options: ['eat', 'eats', 'eating', 'ate'],
        correct: 'eat',
      },
      {
        kind: 'fill_blank',
        prompt: 'She ___ milk every day.',
        options: ['drinks', 'drink', 'drank', 'drinking'],
        correct: 'drinks',
      },
    ],
    5: [
      {
        kind: 'fill_blank',
        prompt: 'The dog ___ happy.',
        options: ['is', 'are', 'am', 'be'],
        correct: 'is',
      },
      {
        kind: 'order_words',
        prompt: 'Build the sentence:',
        options: ['a', 'have', 'I', 'cat'],
        correct: ['I', 'have', 'a', 'cat'],
      },
    ],
    6: [
      {
        kind: 'fill_blank',
        prompt: 'I have two ___.',
        options: ['eyes', 'eye', 'eyess', 'eyed'],
        correct: 'eyes',
      },
      {
        kind: 'fill_blank',
        prompt: 'My ___ is big.',
        options: ['nose', 'noses', 'nosing', 'noseful'],
        correct: 'nose',
      },
    ],
    7: [
      {
        kind: 'fill_blank',
        prompt: 'I have ___ fingers.',
        options: ['five', 'fives', 'fived', 'fiving'],
        correct: 'five',
      },
      {
        kind: 'order_words',
        prompt: 'Build the sentence:',
        options: ['three', 'are', 'lamps', 'There'],
        correct: ['There', 'are', 'three', 'lamps'],
      },
    ],
    8: [
      { kind: 'fill_blank', prompt: 'I ___ to school every day.', options: ['go', 'goes', 'going', 'went'], correct: 'go' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['teacher', 'My', 'is', 'kind'], correct: ['My', 'teacher', 'is', 'kind'] },
    ],
    9: [
      { kind: 'fill_blank', prompt: 'The table is in the ___.', options: ['kitchen', 'kitchens', 'kitchened', 'kitchening'], correct: 'kitchen' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['love', 'I', 'my', 'bedroom'], correct: ['I', 'love', 'my', 'bedroom'] },
    ],
    10: [
      { kind: 'fill_blank', prompt: 'She ___ a red dress today.', options: ['wears', 'wear', 'wearing', 'worn'], correct: 'wears' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['on', 'Put', 'your', 'shoes'], correct: ['Put', 'your', 'shoes', 'on'] },
    ],
    11: [
      { kind: 'fill_blank', prompt: 'Today ___ very sunny outside.', options: ['is', 'are', 'am', 'be'], correct: 'is' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['cold', 'is', 'It', 'today'], correct: ['It', 'is', 'cold', 'today'] },
    ],
    12: [
      { kind: 'fill_blank', prompt: 'I go to school by ___.', options: ['bus', 'buss', 'busing', 'bused'], correct: 'bus' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['by', 'travel', 'I', 'plane'], correct: ['I', 'travel', 'by', 'plane'] },
    ],
    13: [
      { kind: 'fill_blank', prompt: 'I wake up in the ___.', options: ['morning', 'mornings', 'morn', 'morned'], correct: 'morning' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['evening', 'Bobo', 'the', 'in', 'eats'], correct: ['Bobo', 'eats', 'in', 'the', 'evening'] },
    ],
    14: [
      { kind: 'fill_blank', prompt: 'She ___ an orange every day.', options: ['eats', 'eat', 'eating', 'ate'], correct: 'eats' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['bananas', 'I', 'yellow', 'like'], correct: ['I', 'like', 'yellow', 'bananas'] },
    ],
    15: [
      { kind: 'fill_blank', prompt: 'The ___ is very tall and green.', options: ['tree', 'trees', 'treeing', 'treed'], correct: 'tree' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['the', 'grow', 'flowers', 'by', 'river'], correct: ['flowers', 'grow', 'by', 'the', 'river'] },
    ],
    16: [
      { kind: 'fill_blank', prompt: 'Bobo can ___ very fast.', options: ['run', 'runs', 'running', 'ran'], correct: 'run' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['swim', 'can', 'I', 'well'], correct: ['I', 'can', 'swim', 'well'] },
    ],
    17: [
      { kind: 'fill_blank', prompt: 'She loves to ___ songs.', options: ['sing', 'sings', 'singing', 'sang'], correct: 'sing' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['to', 'love', 'I', 'dance'], correct: ['I', 'love', 'to', 'dance'] },
    ],
    18: [
      { kind: 'fill_blank', prompt: 'I ___ happy when I play.', options: ['am', 'is', 'are', 'be'], correct: 'am' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['makes', 'me', 'Music', 'happy'], correct: ['Music', 'makes', 'me', 'happy'] },
    ],
    19: [
      { kind: 'fill_blank', prompt: 'She ___ sick yesterday.', options: ['was', 'is', 'are', 'were'], correct: 'was' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['see', 'should', 'You', 'a', 'doctor'], correct: ['You', 'should', 'see', 'a', 'doctor'] },
    ],
    20: [
      { kind: 'fill_blank', prompt: 'My dad ___ a doctor.', options: ['is', 'are', 'am', 'be'], correct: 'is' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['to', 'want', 'be', 'I', 'a', 'pilot'], correct: ['I', 'want', 'to', 'be', 'a', 'pilot'] },
    ],
    21: [
      { kind: 'fill_blank', prompt: "Let's go to the ___ today.", options: ['park', 'parks', 'parking', 'parked'], correct: 'park' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['the', 'love', 'I', 'library'], correct: ['I', 'love', 'the', 'library'] },
    ],
    22: [
      { kind: 'fill_blank', prompt: 'My favourite ___ is summer.', options: ['season', 'seasons', 'seasonal', 'seasoned'], correct: 'season' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['winter', 'In', 'snow', 'there', 'is'], correct: ['In', 'winter', 'there', 'is', 'snow'] },
    ],
    23: [
      { kind: 'fill_blank', prompt: 'I have ___ fingers on my hands.', options: ['ten', 'tens', 'tened', 'tening'], correct: 'ten' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['friends', 'have', 'I', 'seven'], correct: ['I', 'have', 'seven', 'friends'] },
    ],
    24: [
      { kind: 'fill_blank', prompt: 'The ___ is warm and blue.', options: ['sea', 'sees', 'seaing', 'seaed'], correct: 'sea' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['on', 'play', 'I', 'the', 'beach'], correct: ['I', 'play', 'on', 'the', 'beach'] },
    ],
    25: [
      { kind: 'fill_blank', prompt: 'He ___ computer games every day.', options: ['plays', 'play', 'playing', 'played'], correct: 'plays' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['your', 'away', 'Put', 'phone'], correct: ['Put', 'your', 'phone', 'away'] },
    ],
    26: [
      { kind: 'fill_blank', prompt: 'She likes to ___ books.', options: ['read', 'reads', 'reading', 'readed'], correct: 'read' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['hobby', 'is', 'My', 'drawing'], correct: ['My', 'hobby', 'is', 'drawing'] },
    ],
    27: [
      { kind: 'fill_blank', prompt: 'School starts on ___.', options: ['Monday', 'Mondays', 'A Monday', 'The Monday'], correct: 'Monday' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['is', 'Today', 'Wednesday'], correct: ['Today', 'is', 'Wednesday'] },
    ],
    28: [
      { kind: 'fill_blank', prompt: 'An elephant is ___ and a mouse is small.', options: ['big', 'bigs', 'bigging', 'bigged'], correct: 'big' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['is', 'A', 'cheetah', 'fast'], correct: ['A', 'cheetah', 'is', 'fast'] },
    ],
    29: [
      { kind: 'fill_blank', prompt: 'We must ___ each other.', options: ['help', 'helps', 'helping', 'helped'], correct: 'help' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['together', 'stronger', 'are', 'We'], correct: ['We', 'are', 'stronger', 'together'] },
    ],
    30: [
      { kind: 'fill_blank', prompt: 'You are a true ___!', options: ['champion', 'champions', 'championed', 'championing'], correct: 'champion' },
      { kind: 'order_words', prompt: 'Build the sentence:', options: ['you', 'Thank', 'everything', 'for'], correct: ['Thank', 'you', 'for', 'everything'] },
    ],
  },
  ru: {
    1: [
      {
        kind: 'fill_blank',
        prompt: 'Это ___ дом.',
        options: ['мой', 'моя', 'моё', 'мои'],
        correct: 'мой',
      },
      {
        kind: 'order_words',
        prompt: 'Составь предложение:',
        options: ['зовут', 'Меня', 'Bobo'],
        correct: ['Меня', 'зовут', 'Bobo'],
      },
    ],
    2: [
      {
        kind: 'fill_blank',
        prompt: 'Небо ___ синее.',
        options: ['такое', 'очень', 'есть', 'было'],
        correct: 'очень',
      },
      {
        kind: 'fill_blank',
        prompt: '___ цвет мне нравится.',
        options: ['Этот', 'Эта', 'Это', 'Эти'],
        correct: 'Этот',
      },
    ],
    3: [
      {
        kind: 'fill_blank',
        prompt: 'У меня есть ___ сестра.',
        options: ['старшая', 'старший', 'старшее', 'старших'],
        correct: 'старшая',
      },
      {
        kind: 'order_words',
        prompt: 'Составь предложение:',
        options: ['мама', 'любит', 'Моя', 'петь'],
        correct: ['Моя', 'мама', 'любит', 'петь'],
      },
    ],
    4: [
      {
        kind: 'fill_blank',
        prompt: 'Я ем ___ яблоко.',
        options: ['вкусное', 'вкусный', 'вкусная', 'вкусных'],
        correct: 'вкусное',
      },
      {
        kind: 'fill_blank',
        prompt: 'Он пьёт ___ молоко.',
        options: ['холодное', 'холодный', 'холодная', 'холодных'],
        correct: 'холодное',
      },
    ],
    5: [
      {
        kind: 'fill_blank',
        prompt: 'У меня есть ___ собака.',
        options: ['добрая', 'добрый', 'доброе', 'добрых'],
        correct: 'добрая',
      },
      {
        kind: 'order_words',
        prompt: 'Составь предложение:',
        options: ['есть', 'кошка', 'У', 'меня'],
        correct: ['У', 'меня', 'есть', 'кошка'],
      },
    ],
    6: [
      {
        kind: 'fill_blank',
        prompt: 'У меня ___ глаза.',
        options: ['два', 'две', 'двое', 'двух'],
        correct: 'два',
      },
      {
        kind: 'fill_blank',
        prompt: 'Мой нос ___ маленький.',
        options: ['очень', 'много', 'есть', 'был'],
        correct: 'очень',
      },
    ],
    7: [
      {
        kind: 'fill_blank',
        prompt: 'У меня ___ пальцев.',
        options: ['пять', 'пяти', 'пятый', 'пятеро'],
        correct: 'пять',
      },
      {
        kind: 'order_words',
        prompt: 'Составь предложение:',
        options: ['три', 'есть', 'лампочки', 'У', 'меня'],
        correct: ['У', 'меня', 'есть', 'три', 'лампочки'],
      },
    ],
    8: [
      { kind: 'fill_blank', prompt: 'Я хожу ___ школу каждый день.', options: ['в', 'на', 'к', 'из'], correct: 'в' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['добрый', 'Мой', 'учитель', 'очень'], correct: ['Мой', 'учитель', 'очень', 'добрый'] },
    ],
    9: [
      { kind: 'fill_blank', prompt: 'Стол стоит ___ кухне.', options: ['на', 'в', 'под', 'за'], correct: 'на' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['люблю', 'свою', 'Я', 'спальню'], correct: ['Я', 'люблю', 'свою', 'спальню'] },
    ],
    10: [
      { kind: 'fill_blank', prompt: 'Она носит ___ платье.', options: ['красивое', 'красивый', 'красивая', 'красивых'], correct: 'красивое' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['свои', 'Надень', 'туфли'], correct: ['Надень', 'свои', 'туфли'] },
    ],
    11: [
      { kind: 'fill_blank', prompt: 'Сегодня ___ очень солнечно.', options: ['на улице', 'в улице', 'по улице', 'за улицу'], correct: 'на улице' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['холодно', 'Сегодня', 'очень'], correct: ['Сегодня', 'очень', 'холодно'] },
    ],
    12: [
      { kind: 'fill_blank', prompt: 'Я езжу в школу ___ автобусе.', options: ['на', 'в', 'по', 'за'], correct: 'на' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['самолёте', 'лечу', 'Я', 'на'], correct: ['Я', 'лечу', 'на', 'самолёте'] },
    ],
    13: [
      { kind: 'fill_blank', prompt: 'Я просыпаюсь ___ утром.', options: ['каждым', 'каждое', 'каждый', 'каждой'], correct: 'каждое' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['вечером', 'ест', 'Bobo'], correct: ['Bobo', 'ест', 'вечером'] },
    ],
    14: [
      { kind: 'fill_blank', prompt: 'Она ест ___ каждый день.', options: ['апельсин', 'апельсину', 'апельсином', 'апельсини'], correct: 'апельсин' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['бананы', 'жёлтые', 'люблю', 'Я'], correct: ['Я', 'люблю', 'жёлтые', 'бананы'] },
    ],
    15: [
      { kind: 'fill_blank', prompt: '___ очень высокое и зелёное.', options: ['Дерево', 'Деревья', 'Деревом', 'Дереву'], correct: 'Дерево' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['реки', 'растут', 'у', 'Цветы'], correct: ['Цветы', 'растут', 'у', 'реки'] },
    ],
    16: [
      { kind: 'fill_blank', prompt: 'Bobo умеет ___ очень быстро.', options: ['бегать', 'бегает', 'бежать', 'бегал'], correct: 'бегать' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['плавать', 'умею', 'хорошо', 'Я'], correct: ['Я', 'умею', 'хорошо', 'плавать'] },
    ],
    17: [
      { kind: 'fill_blank', prompt: 'Она любит ___ песни.', options: ['петь', 'поёт', 'пела', 'пою'], correct: 'петь' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['танцевать', 'Я', 'люблю'], correct: ['Я', 'люблю', 'танцевать'] },
    ],
    18: [
      { kind: 'fill_blank', prompt: 'Я ___ когда играю.', options: ['радуюсь', 'радуется', 'радуемся', 'радуются'], correct: 'радуюсь' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['меня', 'радует', 'Музыка'], correct: ['Музыка', 'меня', 'радует'] },
    ],
    19: [
      { kind: 'fill_blank', prompt: 'Она ___ больна вчера.', options: ['была', 'есть', 'будет', 'бывает'], correct: 'была' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['к', 'идти', 'надо', 'доктору', 'Тебе'], correct: ['Тебе', 'надо', 'идти', 'к', 'доктору'] },
    ],
    20: [
      { kind: 'fill_blank', prompt: 'Мой папа ___ доктором.', options: ['является', 'являются', 'являешься', 'являюсь'], correct: 'является' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['стать', 'Я', 'пилотом', 'хочу'], correct: ['Я', 'хочу', 'стать', 'пилотом'] },
    ],
    21: [
      { kind: 'fill_blank', prompt: 'Пойдём сегодня ___ парк.', options: ['в', 'на', 'к', 'по'], correct: 'в' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['библиотеку', 'люблю', 'Я'], correct: ['Я', 'люблю', 'библиотеку'] },
    ],
    22: [
      { kind: 'fill_blank', prompt: 'Моё любимое время ___ — лето.', options: ['года', 'год', 'годом', 'лет'], correct: 'года' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['зимой', 'падает', 'снег', 'Белый'], correct: ['Белый', 'снег', 'падает', 'зимой'] },
    ],
    23: [
      { kind: 'fill_blank', prompt: 'У меня ___ пальцев на руках.', options: ['десять', 'десяти', 'десятый', 'десятеро'], correct: 'десять' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['друзей', 'семь', 'У', 'меня', 'есть'], correct: ['У', 'меня', 'есть', 'семь', 'друзей'] },
    ],
    24: [
      { kind: 'fill_blank', prompt: '___ тёплое и голубое.', options: ['Море', 'Морем', 'Морю', 'Моря'], correct: 'Море' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['на', 'играю', 'пляже', 'Я'], correct: ['Я', 'играю', 'на', 'пляже'] },
    ],
    25: [
      { kind: 'fill_blank', prompt: 'Он играет в компьютерные ___ каждый день.', options: ['игры', 'игра', 'игрой', 'игру'], correct: 'игры' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['телефон', 'Убери', 'свой'], correct: ['Убери', 'свой', 'телефон'] },
    ],
    26: [
      { kind: 'fill_blank', prompt: 'Она любит ___ книги.', options: ['читать', 'читает', 'читала', 'читаю'], correct: 'читать' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['хобби', 'рисование', 'Моё'], correct: ['Моё', 'хобби', 'рисование'] },
    ],
    27: [
      { kind: 'fill_blank', prompt: 'Школа начинается ___ понедельник.', options: ['в', 'на', 'по', 'за'], correct: 'в' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['среда', 'Сегодня'], correct: ['Сегодня', 'среда'] },
    ],
    28: [
      { kind: 'fill_blank', prompt: 'Слон ___, а мышь маленькая.', options: ['большой', 'большое', 'большая', 'большие'], correct: 'большой' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['быстрый', 'гепард', 'очень', 'Этот'], correct: ['Этот', 'гепард', 'очень', 'быстрый'] },
    ],
    29: [
      { kind: 'fill_blank', prompt: 'Мы должны ___ друг другу.', options: ['помогать', 'помогает', 'помогал', 'помогаю'], correct: 'помогать' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['сильнее', 'Вместе', 'мы'], correct: ['Вместе', 'мы', 'сильнее'] },
    ],
    30: [
      { kind: 'fill_blank', prompt: 'Ты настоящий ___!', options: ['чемпион', 'чемпиона', 'чемпионом', 'чемпионе'], correct: 'чемпион' },
      { kind: 'order_words', prompt: 'Составь предложение:', options: ['всё', 'за', 'тебя', 'Спасибо'], correct: ['Спасибо', 'тебя', 'за', 'всё'] },
    ],
  },
};
