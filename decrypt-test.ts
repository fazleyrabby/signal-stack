import { PulseEncryptionService } from './backend/src/pulse/services/pulse-encryption.service';
import { ConfigService } from '@nestjs/config';

const config = new ConfigService();
const enc = new PulseEncryptionService(config);

const apiKey = "cfada78168fa478b617b896c0bbac5e6ff5f17f5528c7d67c2859b78c9b4821447fe3e1cb59b8324383e149d0fb4f0061a8bbfb819";
const apiSecret = "6f52f3c915ba6ec93abf8ac4c652cd4c55f6e74eca8d4c5e422c2db137985d48cb7428bdeccf7ede8a104a79acae3061338d21f8a2225160d183ad0650cb2d1298a3e239d9949e15d43480772434";
const accessToken = "4fa6ff2473cf2ea708446e8284443b7752da623a963345fb7e1c14032af342be7b8e2f24a1d62533c649eda2ffe2325915fa33471b78f9c03ffdcf4a9a0890457d82539f10bec9569c4d70dec6f5";
const accessTokenSecret = "728b12cfc32a8c389ccc16dbaa7c412d5266ad4e758a3a03991c0cd80d7a4a4b6194a2c811770f2aeaed060ab29e808c245b5cd440fe52b6582ec48a41c5676a9cca7878b32facc7e8";

console.log("X_API_KEY", enc.decrypt(apiKey));
console.log("X_API_SECRET", enc.decrypt(apiSecret));
console.log("X_ACCESS_TOKEN", enc.decrypt(accessToken));
console.log("X_ACCESS_TOKEN_SECRET", enc.decrypt(accessTokenSecret));
