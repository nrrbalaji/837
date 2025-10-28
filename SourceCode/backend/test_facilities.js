import { getAllFacilities } from './services/facilityService.js';

async function test() {
  try {
    console.log('Testing getAllFacilities with pagination...');
    const result = await getAllFacilities({
      page: 1,
      limit: 20,
      sortField: 'facility_name',
      sortOrder: 'asc',
      filters: {
        search: '',
        facilityType: '',
        state: '',
        isActive: ''
      }
    });
    console.log('✅ Success! Found', result.facilities?.length, 'facilities');
    console.log('Sample facility:', JSON.stringify(result.facilities[0], null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
