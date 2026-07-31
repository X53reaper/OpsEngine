import { wrapEmail, sectionHeader, bodyText, ctaButton, infoCard, PALETTES } from '../email-templates'

export function welcomeEmail(data: {
  userName: string
  isOperator: boolean
  dashboardUrl: string
  nextSteps?: string[]
}): string {
  const content = data.isOperator
    ? `
    ${sectionHeader('Your Business is Live!', 'Welcome to Safari Zetu')}
    ${bodyText(`Dear ${data.userName},`)}
    ${bodyText('Congratulations! Your safari business is now live on Safari Zetu. Tourists from around the world can now discover and book your experiences.')}
    ${infoCard('Next steps: Complete your profile, upload photos, and set your availability to start receiving bookings.')}
    ${ctaButton('Go to Dashboard', data.dashboardUrl)}
  `
    : `
    ${sectionHeader('Welcome to Safari Zetu', 'Your African adventure starts here')}
    ${bodyText(`Dear ${data.userName},`)}
    ${bodyText('Welcome to Safari Zetu — your gateway to authentic African safari experiences. Browse our curated collection of wildlife encounters, cultural immersions, and adventure tours across Zimbabwe.')}
    ${ctaButton('Explore Safaris', data.dashboardUrl)}
  `

  return wrapEmail(content, {
    preheader: data.isOperator
      ? 'Your safari business is now live on Safari Zetu!'
      : 'Welcome to Safari Zetu — explore African safaris',
    palette: 'heritage'
  })
}

export function onboardingReminderEmail(data: {
  userName: string
  progressPct: number
  dashboardUrl: string
}): string {
  const content = `
    ${sectionHeader('Complete Your Profile', `${data.progressPct}% complete`)}
    ${bodyText(`Dear ${data.userName},`)}
    ${bodyText(`Your profile is ${data.progressPct}% complete. Finish setting up to unlock all features and start receiving bookings.`)}
    ${ctaButton('Complete Profile', data.dashboardUrl)}
  `

  return wrapEmail(content, {
    preheader: `Your profile is ${data.progressPct}% complete — finish to start receiving bookings`,
    palette: 'heritage'
  })
}
