// Single source of truth for selectable profile options. Served to the frontend via GET /api/meta.

export const INTENTS = ['Friendship', 'Serious relationship', 'Networking', 'Study partner', 'Co-founder', 'Mentorship'];

export const INTERESTS = [
  'Travel', 'Photography', 'Cricket', 'Football', 'Cooking', 'Reading', 'Gaming', 'Fitness', 'Hiking', 'Music',
  'Art', 'Tech', 'Startups', 'Movies', 'Poetry', 'Coffee', 'Fashion', 'Volunteering', 'Chess', 'Coding', 'Design',
  'Writing', 'Badminton', 'Calligraphy', 'Podcasts', 'Nature', 'Yoga', 'Running', 'Cycling', 'Dancing', 'Languages',
  'History', 'Science', 'Investing', 'Food', 'Pets', 'Gardening', 'Anime', 'Theatre', 'Swimming',
];

export const CITIES = [
  'Islamabad', 'Lahore', 'Karachi', 'Rawalpindi', 'Peshawar', 'Multan', 'Faisalabad', 'Quetta', 'Hyderabad', 'Sialkot',
  'Gujranwala', 'Abbottabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Mardan', 'Gilgit', 'Muzaffarabad',
  'Dubai', 'Riyadh', 'London', 'Toronto', 'New York', 'Remote / Online',
];

// Generic distractors used only when generating quiz options.
export const JOB_POOL = [
  'Software Engineer', 'Doctor', 'Teacher', 'Architect', 'Civil Engineer', 'Data Scientist', 'UX Designer', 'Lawyer',
  'Pharmacist', 'Entrepreneur', 'Banker', 'Journalist', 'Chef', 'Photographer', 'Product Manager', 'Accountant',
  'Student', 'Nurse', 'Marketing Manager', 'Content Creator', 'Mechanical Engineer', 'Researcher', 'Pilot', 'Consultant',
];
export const EDU_POOL = [
  'NUST', 'LUMS', 'FAST', 'UET Lahore', 'IBA Karachi', 'COMSATS', 'Aga Khan University', 'Quaid-i-Azam University',
  'NCA Lahore', 'GIKI', 'University of Punjab', 'Air University', 'Bahria University', 'PIEAS', 'NED University',
];
export const LANG_POOL = ['Urdu', 'English', 'Punjabi', 'Pashto', 'Sindhi', 'Balochi', 'Saraiki', 'Arabic', 'Persian', 'Chinese', 'French', 'Turkish'];

export const PROMPTS: Record<string, string[]> = {
  'My perfect weekend': [
    'A sunrise hike followed by chai', 'Binge-watching a series with biryani', 'A road trip up north',
    'Sleeping in and a long brunch', 'Cricket with friends and a BBQ at night', 'Exploring old bookstores',
  ],
  'I geek out about': [
    'Space and black holes', 'Mechanical keyboards', 'Old Pakistani dramas', 'Coffee brewing methods',
    'Formula 1 strategy', 'Urban planning', 'Personal finance', 'Ancient history',
  ],
  'A green flag for me': [
    'Being kind to waiters', 'Remembering the small details', 'Replying with full sentences', 'Being punctual',
    'Asking good questions', 'Owning up to mistakes',
  ],
  'My most unusual skill': [
    'Solving a Rubik’s cube in a minute', 'Cooking for 50 people', 'Whistling any tune', 'Reading upside down',
    'Remembering every phone number', 'Fixing old radios',
  ],
  'The best trip I ever took': [
    'Hunza in autumn', 'A week in Istanbul', 'Umrah with my family', 'Skardu by road', 'Backpacking in Thailand', 'Swat valley in spring',
  ],
  'I’m currently learning': [
    'To play the guitar', 'Machine learning', 'Arabic', 'How to swim', 'Public speaking', 'Baking bread',
  ],
  'My comfort food': ['Daal chawal', 'Nihari', 'Pizza', 'Chicken karahi', 'Gol gappay', 'Haleem'],
  'Something I can talk about for hours': [
    'Cricket history', 'Startups', 'Movies', 'Poetry', 'Philosophy', 'Travel stories',
  ],
};
export const PROMPT_QUESTIONS = Object.keys(PROMPTS);
