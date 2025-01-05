import { DeepSeekService } from '../lib/services/deepseekService';
import { Business } from '../lib/types';
import axios from 'axios';

async function testOllamaConnection() {
    console.log('🔍 Testing Ollama connection...\n');
    
    try {
        // Test simple connection
        console.log('Testing Qwen model...');
        const response = await DeepSeekService['chat']([{
            role: 'user',
            content: 'Say "Hello, testing Qwen model!"'
        }]);
        
        console.log('✅ Model Response:', response);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            console.error('❌ Connection test failed:', error.message);
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    console.error('❌ Make sure Ollama is running (ollama serve)');
                } else {
                    console.error('API Error details:', error.response?.data);
                }
            }
        } else {
            console.error('❌ Connection test failed with unknown error');
        }
        return false;
    }
}

async function testDataCleaning() {
    console.log('\n🧪 Testing business data cleaning...');
    
    const testCases: Business[] = [
        {
            id: 'test_1',
            name: "Denver's Best Plumbing & Repair [LLC] (A Family Business) {Est. 1995}",
            address: "CONTACT US TODAY! Suite 200-B, 1234 Main Street, Denver, Colorado 80202 (Near Starbucks)",
            phone: "☎️ Main: (720) 555-1234 | Emergency: 1-800-555-9999 | Text: 720.555.4321",
            email: "[support@denverplumbing.com](mailto:support@denverplumbing.com) or info@denverplumbing.com",
            description: `$$$ LIMITED TIME OFFER $$$
                🚰 Professional plumbing services in Denver metro area
                💰 20% OFF all repairs over $500!
                ⭐️ Family owned since 1995
                📞 Available 24/7 for emergencies
                🌐 Visit www.denverplumbing.com
                📧 Email us at contact@denverplumbing.com
                💳 All major credit cards accepted
                #DenverPlumbing #EmergencyService`,
            source: 'test',
            website: 'https://example.com',
            rating: 4.8,
            logo: 'logo.png',
            location: { lat: 39.7392, lng: -104.9903 },
            openingHours: []
        },
        {
            id: 'test_2',
            name: "[MIKE'S AUTO] {{CERTIFIED}} [BMW & AUDI SPECIALIST]",
            address: "GET DIRECTIONS: 5678 Auto Row Drive\nUnit C-123\nDenver, CO 80205\nBehind Home Depot",
            phone: "Sales: 303-555-0000\nService: (303) 555-1111\nFax: 303.555.2222",
            email: "appointments@mikesauto.com <click to email> [Schedule Now](https://booking.mikesauto.com)",
            description: `🚗 Denver's Premier Auto Service Center
                💯 ASE Certified Mechanics
                🔧 Specializing in German Luxury Vehicles
                💰💰💰 Spring Special: Free oil change with any service over $300
                ⚡️ Same-day service available
                🎯 Located in central Denver
                📱 Text "REPAIR" to 80205 for $50 off
                ⭐️⭐️⭐️⭐️⭐️ Over 500 5-star reviews!`,
            source: 'test',
            website: 'https://mikesauto.com',
            rating: 4.9,
            logo: 'logo.png',
            location: { lat: 39.7599, lng: -104.9987 },
            openingHours: ['Mon-Fri 8-6', 'Sat 9-3']
        },
        {
            id: 'test_3',
            name: "🌟 SUNSHINE DENTAL & ORTHODONTICS, P.C. [Dr. Smith & Associates] (Voted #1)",
            address: "SCHEDULE TODAY!\n🦷 Building 3, Suite 300\n9876 Medical Plaza Way\nDENVER COLORADO, 80210\nNext to Target",
            phone: "📞 New Patients: 1 (720) 999-8888 | Existing: 720.999.7777 | After Hours: +1-720-999-6666",
            email: "appointments@sunshinedentalco.com, info@sunshinedentalco.com, emergency@sunshinedentalco.com",
            description: `✨ Your Premier Dental Care Provider in Denver! ✨
                🦷 State-of-the-art facility
                💎 Cosmetic & General Dentistry
                👶 Family-friendly environment
                💰 NEW PATIENT SPECIAL: $99 Cleaning & Exam (Reg. $299)
                🏥 Most insurance accepted
                ⭐️ 1,000+ 5-star reviews on Google
                🎁 Refer a friend and get $50 credit
                📱 Download our app: smile.sunshinedentalco.com`,
            source: 'test',
            website: 'https://sunshinedentalco.com',
            rating: 5.0,
            logo: 'logo.png',
            location: { lat: 39.7120, lng: -104.9412 },
            openingHours: ['Mon-Thu 8-5', 'Fri 8-2', 'Sat By Appt']
        },
        {
            id: 'test_4',
            name: "THE COFFEE SPOT ☕️ {{NOW OPEN}} [Under New Management!]",
            address: "ORDER PICKUP:\nGround Floor\n4321 Downtown Street\nDenver, CO. 80203\nInside Union Station",
            phone: "☎️ Store: 303•777•5555\n💬 Text Orders: 303-777-4444",
            email: "<Order Online> orders@thecoffeespot.co [Click Here](https://order.thecoffeespot.co)",
            description: `☕️ Denver's Favorite Coffee Shop Since 2020!
                🌱 Organic, Fair-Trade Coffee
                🥐 Fresh-Baked Pastries Daily
                ⚡️ MORNING RUSH SPECIAL: $2 off any drink before 9am!
                🎯 Loyalty Program: Buy 9, Get 1 FREE
                📱 Order ahead on our app
                🎁 Student Discount: 10% off with ID
                #CoffeeLovers #DenverCoffee #MorningFuel
                Follow us @thecoffeespot for daily specials!`,
            source: 'test',
            website: 'https://thecoffeespot.co',
            rating: 4.7,
            logo: 'logo.png',
            location: { lat: 39.7508, lng: -104.9997 },
            openingHours: ['Mon-Fri 6-8', 'Sat-Sun 7-7']
        }
    ];

    for (const testCase of testCases) {
        console.log('\nTesting case:', testCase.id);
        console.log('Input data:', JSON.stringify(testCase, null, 2));
        
        console.time('Cleaning Duration');
        const cleaned = await DeepSeekService.cleanBusinessData(testCase);
        console.timeEnd('Cleaning Duration');
        
        console.log('\nCleaned data:', JSON.stringify(cleaned, null, 2));
        
        // Validate the results
        const validationIssues = [];
        
        // Name validation
        if (cleaned.name?.match(/[\[\]{}()]/)) {
            validationIssues.push('Name contains brackets/braces/parentheses');
        }
        
        // Address validation
        if (!cleaned.address?.match(/^\d+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}$/)) {
            validationIssues.push('Address format incorrect');
        }
        
        // Phone validation
        if (!cleaned.phone?.match(/^\(\d{3}\) \d{3}-\d{4}$/)) {
            validationIssues.push('Phone format incorrect');
        }
        
        // Email validation
        if (cleaned.email?.match(/[\[\]<>()]|mailto:|click|schedule/i)) {
            validationIssues.push('Email contains formatting/links');
        }
        
        // Description validation
        const descriptionIssues = [];
        if (cleaned.description?.match(/[\$\d]+%?\s*off|\$/i)) {
            descriptionIssues.push('contains pricing');
        }
        if (cleaned.description?.match(/\b(?:call|email|visit|contact|text|www\.|http|@)\b/i)) {
            descriptionIssues.push('contains contact info');
        }
        if (cleaned.description?.match(/[📞📧🌐💳☎️📱]/)) {
            descriptionIssues.push('contains emojis');
        }
        if (cleaned.description?.match(/#\w+/)) {
            descriptionIssues.push('contains hashtags');
        }
        if (descriptionIssues.length > 0) {
            validationIssues.push(`Description ${descriptionIssues.join(', ')}`);
        }

        if (validationIssues.length > 0) {
            console.log('\n⚠️ Validation issues:', validationIssues.join(', '));
        } else {
            console.log('\n✅ All fields cleaned successfully');
        }
    }
}

async function runTests() {
    console.log('🚀 Starting Qwen model tests...\n');
    
    const connectionSuccess = await testOllamaConnection();
    if (!connectionSuccess) {
        console.log('❌ Stopping tests due to connection failure');
        return;
    }
    
    await testDataCleaning();
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
} 