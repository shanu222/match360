// Single source of truth for selectable profile options. Served to the frontend via GET /api/meta.

export const INTENTS = ['Friendship', 'Serious relationship', 'Marriage', 'Networking', 'Study partner', 'Co-founder', 'Mentorship'];
export const GENDERS = ['Woman', 'Man', 'Non-binary'];
export const INTERESTED_IN = ['Everyone', 'Women', 'Men'];

export const INTERESTS = [
  'Travel', 'Photography', 'Cricket', 'Football', 'Cooking', 'Reading', 'Gaming', 'Fitness', 'Hiking', 'Music',
  'Art', 'Tech', 'Startups', 'Movies', 'Poetry', 'Coffee', 'Fashion', 'Volunteering', 'Chess', 'Coding', 'Design',
  'Writing', 'Badminton', 'Calligraphy', 'Podcasts', 'Nature', 'Yoga', 'Running', 'Cycling', 'Dancing', 'Languages',
  'History', 'Science', 'Investing', 'Food', 'Pets', 'Gardening', 'Anime', 'Theatre', 'Swimming', 'Squash', 'Tennis',
  'Hockey', 'Baking', 'Camping', 'Architecture', 'Philosophy', 'Psychology', 'Entrepreneurship', 'Public speaking',
];

export const EDUCATION_LEVELS = ['High school', 'Diploma', "Bachelor's", "Master's", 'MPhil', 'PhD', 'Professional (MBBS, CA, LLB…)', 'Other'];
export const INDUSTRIES = [
  'Technology', 'Engineering', 'Healthcare', 'Education', 'Finance & Banking', 'Government', 'Law', 'Marketing & Media',
  'Design & Arts', 'Construction', 'Retail & Trade', 'Manufacturing', 'Hospitality', 'Agriculture', 'Non-profit',
  'Transport & Logistics', 'Energy', 'Research', 'Student', 'Self-employed', 'Other',
];
export const MARITAL = ['Never married', 'Divorced', 'Widowed', 'Separated', 'Prefer not to say'];
export const CHILDREN = ["Don't have children", 'Have children', 'Want children', "Don't want children", 'Not sure yet'];
export const SMOKING = ['Never', 'Sometimes', 'Regularly', 'Trying to quit'];
export const DRINKING = ['Never', 'Socially', 'Regularly'];
export const RELIGIONS = ['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Judaism', 'Spiritual', 'Not religious', 'Other', 'Prefer not to say'];

// Generic distractors used only when generating fallback quiz options.
export const JOB_POOL = [
  'Software Engineer', 'Doctor', 'Teacher', 'Architect', 'Civil Engineer', 'Data Scientist', 'UX Designer', 'Lawyer',
  'Pharmacist', 'Entrepreneur', 'Banker', 'Journalist', 'Chef', 'Photographer', 'Product Manager', 'Accountant',
  'Student', 'Nurse', 'Marketing Manager', 'Content Creator', 'Mechanical Engineer', 'Researcher', 'Pilot', 'Consultant',
];
export const EDU_POOL = [
  'NUST', 'LUMS', 'FAST', 'UET Lahore', 'IBA Karachi', 'COMSATS', 'Aga Khan University', 'Quaid-i-Azam University',
  'NCA Lahore', 'GIKI', 'University of Punjab', 'Air University', 'Bahria University', 'PIEAS', 'NED University',
];
export const COMPANY_POOL = ['Systems Ltd', 'Jazz', 'HBL', 'Engro', 'Careem', 'NESPAK', 'PTCL', 'Unilever', 'Nestlé', 'Telenor', 'Netsol', 'K-Electric', 'Meezan Bank', 'Arbisoft'];
export const LANG_POOL = ['Urdu', 'English', 'Punjabi', 'Pashto', 'Sindhi', 'Balochi', 'Saraiki', 'Arabic', 'Persian', 'Chinese', 'French', 'Turkish', 'Hindi', 'Spanish', 'German'];
export const CITY_POOL = ['Islamabad', 'Lahore', 'Karachi', 'Rawalpindi', 'Peshawar', 'Multan', 'Faisalabad', 'Quetta', 'Dubai', 'London', 'Toronto', 'Riyadh'];

export const PROMPTS: Record<string, string[]> = {
  'My perfect weekend': ['A sunrise hike followed by chai', 'Binge-watching a series with biryani', 'A road trip up north', 'Sleeping in and a long brunch', 'Cricket with friends and a BBQ at night', 'Exploring old bookstores'],
  'I geek out about': ['Space and black holes', 'Mechanical keyboards', 'Old Pakistani dramas', 'Coffee brewing methods', 'Formula 1 strategy', 'Urban planning', 'Personal finance', 'Ancient history'],
  'A green flag for me': ['Being kind to waiters', 'Remembering the small details', 'Replying with full sentences', 'Being punctual', 'Asking good questions', 'Owning up to mistakes'],
  'My most unusual skill': ['Solving a Rubik’s cube in a minute', 'Cooking for 50 people', 'Whistling any tune', 'Reading upside down', 'Remembering every phone number', 'Fixing old radios'],
  'The best trip I ever took': ['Hunza in autumn', 'A week in Istanbul', 'Umrah with my family', 'Skardu by road', 'Backpacking in Thailand', 'Swat valley in spring'],
  'I’m currently learning': ['To play the guitar', 'Machine learning', 'Arabic', 'How to swim', 'Public speaking', 'Baking bread'],
  'My comfort food': ['Daal chawal', 'Nihari', 'Pizza', 'Chicken karahi', 'Gol gappay', 'Haleem'],
  'Something I can talk about for hours': ['Cricket history', 'Startups', 'Movies', 'Poetry', 'Philosophy', 'Travel stories'],
  'A goal I’m working towards': ['Running a marathon', 'Starting my own company', 'Getting a PhD', 'Buying a home', 'Learning a new language', 'Travelling to 20 countries'],
  'The values I live by': ['Honesty above all', 'Family comes first', 'Work hard, stay humble', 'Always keep learning', 'Treat everyone with respect', 'Give back to the community'],
  'What my friends say about me': ['I’m always on time', 'I give the best advice', 'I can’t sit still', 'I remember everyone’s birthday', 'I’m the planner of the group', 'I laugh at my own jokes'],
  'My ideal first meeting': ['Coffee and a long walk', 'A bookstore visit', 'Chai at a dhaba', 'A museum afternoon', 'Lunch with good conversation', 'A game of badminton'],
};
export const PROMPT_QUESTIONS = Object.keys(PROMPTS);
