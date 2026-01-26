import { db } from './client';
import { users } from './schema/users';
import { generateSnowflakeId } from './utils/snowflake';

/**
 * Seed data for users table
 */
const seedUsers = [
  {
    username: 'john_doe',
    email: 'john.doe@example.com',
    fullName: 'John Doe',
    bio: 'Software engineer and coffee enthusiast ☕',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=1',
    isVerified: true,
  },
  {
    username: 'jane_smith',
    email: 'jane.smith@example.com',
    fullName: 'Jane Smith',
    bio: 'Designer | Traveler | Dog lover 🐕',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=2',
    isVerified: true,
  },
  {
    username: 'mike_wilson',
    email: 'mike.wilson@example.com',
    fullName: 'Mike Wilson',
    bio: 'Fitness coach and nutrition expert 💪',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=3',
    isVerified: false,
  },
  {
    username: 'sarah_johnson',
    email: 'sarah.johnson@example.com',
    fullName: 'Sarah Johnson',
    bio: 'Food blogger | Recipe creator | Foodie 🍕',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=4',
    isVerified: true,
  },
  {
    username: 'alex_brown',
    email: 'alex.brown@example.com',
    fullName: 'Alex Brown',
    bio: 'Photographer capturing life one frame at a time 📸',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=5',
    isVerified: false,
  },
  {
    username: 'emily_davis',
    email: 'emily.davis@example.com',
    fullName: 'Emily Davis',
    bio: 'Writer | Book lover | Tea addict 📚',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=6',
    isVerified: true,
  },
  {
    username: 'chris_miller',
    email: 'chris.miller@example.com',
    fullName: 'Chris Miller',
    bio: 'Tech enthusiast and gadget reviewer',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=7',
    isVerified: false,
  },
  {
    username: 'lisa_anderson',
    email: 'lisa.anderson@example.com',
    fullName: 'Lisa Anderson',
    bio: 'Yoga instructor | Wellness coach | Mindfulness advocate 🧘',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=8',
    isVerified: true,
  },
  {
    username: 'david_taylor',
    email: 'david.taylor@example.com',
    fullName: 'David Taylor',
    bio: 'Musician | Guitar player | Music producer 🎸',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=9',
    isVerified: false,
  },
  {
    username: 'rachel_white',
    email: 'rachel.white@example.com',
    fullName: 'Rachel White',
    bio: 'Fashion stylist and trend forecaster 👗',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=10',
    isVerified: true,
  },
  {
    username: 'tom_harris',
    email: 'tom.harris@example.com',
    fullName: 'Tom Harris',
    bio: 'Entrepreneur | Startup founder | Innovation lover 🚀',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=11',
    isVerified: false,
  },
  {
    username: 'olivia_martin',
    email: 'olivia.martin@example.com',
    fullName: 'Olivia Martin',
    bio: 'Artist | Painter | Creative soul 🎨',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=12',
    isVerified: true,
  },
  {
    username: 'james_garcia',
    email: 'james.garcia@example.com',
    fullName: 'James Garcia',
    bio: 'Sports enthusiast and basketball player 🏀',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=13',
    isVerified: false,
  },
  {
    username: 'sophia_rodriguez',
    email: 'sophia.rodriguez@example.com',
    fullName: 'Sophia Rodriguez',
    bio: 'Chef | Culinary artist | Food lover 👨‍🍳',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=14',
    isVerified: true,
  },
  {
    username: 'daniel_martinez',
    email: 'daniel.martinez@example.com',
    fullName: 'Daniel Martinez',
    bio: 'Gamer | Streamer | Content creator 🎮',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=15',
    isVerified: false,
  },
  {
    username: 'emma_lee',
    email: 'emma.lee@example.com',
    fullName: 'Emma Lee',
    bio: 'Marketing expert and brand strategist 📊',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=16',
    isVerified: true,
  },
  {
    username: 'ryan_walker',
    email: 'ryan.walker@example.com',
    fullName: 'Ryan Walker',
    bio: 'Nature lover | Hiker | Adventure seeker ⛰️',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=17',
    isVerified: false,
  },
  {
    username: 'ava_hall',
    email: 'ava.hall@example.com',
    fullName: 'Ava Hall',
    bio: 'Dancer | Choreographer | Movement artist 💃',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=18',
    isVerified: true,
  },
  {
    username: 'noah_allen',
    email: 'noah.allen@example.com',
    fullName: 'Noah Allen',
    bio: 'Developer | Open source contributor | Code enthusiast',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=19',
    isVerified: false,
  },
  {
    username: 'mia_young',
    email: 'mia.young@example.com',
    fullName: 'Mia Young',
    bio: 'Environmental activist | Sustainability advocate 🌍',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=20',
    isVerified: true,
  },
];

/**
 * Seed the database with initial data
 */
async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Clear existing users (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing users...');
    await db.delete(users);
    console.log('✅ Cleared existing users\n');

    // Insert users with Snowflake IDs
    console.log('👥 Inserting 20 users...');
    const insertedUsers = [];

    for (const userData of seedUsers) {
      const user = await db.insert(users).values({
        id: generateSnowflakeId(),
        ...userData,
      }).returning();

      if (user[0]) {
        insertedUsers.push(user[0]);
        console.log(`   ✓ Created user: ${userData.username} (${user[0].id})`);
      }
    }

    console.log(`\n✅ Successfully seeded ${insertedUsers.length} users!\n`);

    // Display summary
    console.log('📊 Summary:');
    console.log(`   Total users: ${insertedUsers.length}`);
    console.log(`   Verified users: ${insertedUsers.filter(u => u?.isVerified).length}`);
    console.log(`   Regular users: ${insertedUsers.filter(u => !u?.isVerified).length}`);

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed
seed();

