declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    PAXUM_API_KEY?: string;
    COINBASE_COMMERCE_KEY?: string;
    GEMINI_API_KEY?: string;
    NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
  }
}