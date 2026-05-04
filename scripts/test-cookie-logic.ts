
console.log('--- Cookie Logic Debug ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Is Production?', process.env.NODE_ENV === 'production');

const secureSetting = process.env.NODE_ENV === 'production';
console.log('Computed Secure Setting:', secureSetting);

if (!secureSetting) {
    console.warn('WARNING: Secure is FALSE. This will cause failures in Replit HTTPS environment.');
} else {
    console.log('SUCCESS: Secure is TRUE.');
}
