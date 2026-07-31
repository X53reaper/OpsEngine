const { wrapEmail, sectionHeader, bodyText, keyValue, ctaButton, dataTable, infoCard, divider, PALETTES } = require('/app/dist/services/email-templates');

// Enquiry Acknowledgement
const enquiryHtml = wrapEmail(
    sectionHeader('Thank You for Your Enquiry', "We're on it") +
    bodyText('Dear Sarah Johnson,') +
    bodyText("We've received your enquiry about Victoria Falls and our team is already working on finding the perfect safari experience for you.") +
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">' +
    keyValue('Enquiry Reference', '#SZ-2026-001') +
    keyValue('Destination', 'Victoria Falls') +
    keyValue('Travel Dates', '15-20 August 2026') +
    keyValue('Group Size', '4 travelers') +
    '</table>' +
    bodyText('Our safari specialists will review your requirements and get back to you within 24 hours with personalized recommendations.') +
    ctaButton('View Your Enquiry', 'https://safarizetu.com/enquiries/SZ-2026-001'),
    { preheader: "We've received your enquiry about Victoria Falls and our team is on it.", palette: 'heritage' }
);
console.log('ENQUIRY_HTML_START');
console.log(enquiryHtml);
console.log('ENQUIRY_HTML_END');

// Booking Confirmation
const bookingHtml = wrapEmail(
    sectionHeader('Booking Confirmed', 'Your African adventure awaits') +
    bodyText('Dear Sarah Johnson,') +
    bodyText('Great news! Your safari booking has been confirmed. Here are your booking details:') +
    dataTable(
        ['Detail', 'Information'],
        [
            ['Booking Reference', '#BK-2026-042'],
            ['Safari', 'Victoria Falls Adventure Package'],
            ['Operator', 'The Hide Safari Camp'],
            ['Travel Dates', '15-20 August 2026'],
            ['Group Size', '4 travelers'],
        ]
    ) +
    divider() +
    infoCard('Total: $4,800 | Deposit Paid: $1,200 | Balance Due: $3,600') +
    bodyText('Please save this confirmation email. You can manage your booking and access all details through your dashboard.') +
    ctaButton('Manage Your Booking', 'https://safarizetu.com/bookings/BK-2026-042'),
    { preheader: 'Your safari booking to Victoria Falls Adventure Package has been confirmed!', palette: 'heritage' }
);
console.log('BOOKING_HTML_START');
console.log(bookingHtml);
console.log('BOOKING_HTML_END');

// Revenue Report
const revenueHtml = wrapEmail(
    sectionHeader('Weekly Revenue Report', 'Week of June 14-20, 2026', PALETTES.midnight) +
    bodyText('Hello The Hide Safari Camp,', PALETTES.midnight) +
    bodyText("Here's your revenue performance summary for Week of June 14-20, 2026.", PALETTES.midnight) +
    dataTable(
        ['Metric', 'Value'],
        [
            ['Total Revenue', '$12,450'],
            ['Bookings', '8'],
            ['Average Booking', '$1,556'],
            ['Top Safari', 'Hwange Wilderness Explorer'],
            ['Conversion Rate', '24%'],
        ],
        PALETTES.midnight
    ) +
    divider(PALETTES.midnight) +
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">' +
    keyValue('Commission Owed', '$1,867.50', PALETTES.midnight) +
    '</table>' +
    bodyText('Keep up the great work! Your safari experiences are making a difference for travelers from around the world.', PALETTES.midnight),
    { preheader: 'Your revenue report for Week of June 14-20, 2026 is ready.', palette: 'midnight' }
);
console.log('REVENUE_HTML_START');
console.log(revenueHtml);
console.log('REVENUE_HTML_END');
