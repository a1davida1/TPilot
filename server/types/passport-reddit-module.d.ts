declare module 'passport-reddit/lib/passport-reddit/index.js' {
  import { Strategy } from 'passport';
  
  export class Strategy extends Strategy {
    constructor(options: any, verify: any);
  }
  
  export default Strategy;
}