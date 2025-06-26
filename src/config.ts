// src/config.ts
export const config = {
  BASE_URL: 'https://dokirana-85740.el.r.appspot.com/api', // API base URL for axios
  SOCKET_URL: 'https://dokirana-85740.el.r.appspot.com/', // WebSocket URL for socket.io - removed /api for socket connection,
  TESTING: {
    ENABLED: false,
    TEST_PHONE_NUMBERS: [] as string[],
    DEFAULT_TEST_OTP: '1234',
  }
  
 
};

//https://dokirana-85740.el.r.appspot.com/
//http://10.0.2.2:3000/

