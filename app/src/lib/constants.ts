export enum ActorType {
  AGENT = 'AGENT',
  TALENT = 'TALENT',
  CUSTOMER = 'CUSTOMER',
  TIMER = 'TIMER',
  UNKNOWN = 'UNKNOWN',
  ARBITRATOR = 'ARBITRATOR',
}

export enum EntityType {
  AGENT = 'AGENT',
  TALENT = 'TALENT',
  SHOW = 'SHOW',
  TICKET = 'TICKET',
  USER = 'USER',
}

/* eslint-disable @typescript-eslint/naming-convention */
export enum TokenRoles {
  ADMIN = 'ADMIN',
  PUBLIC = 'PUBLIC',
  AGENT = 'AGENT',
  TALENT = 'TALENT',
}

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const durationFormatter = (duration: number): string => {
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const hoursString = hours > 0 ? `${hours}h ` : '';
  const minuteString = minutes > 0 ? `${minutes}m` : '';
  return `${hoursString} ${minuteString}`.trim();
};

export const jitsiInterfaceConfigOverwrite = {
  MOBILE_APP_PROMO: false,

  TOOLBAR_BUTTONS: [
    'microphone',
    'camera',
    'fullscreen',
    'fodeviceselection',
    'tileview',
  ],

  APP_NAME: 'Champagne Room',
};
