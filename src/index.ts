import 'dotenv/config';
import { createLifeAgentBot } from './bot.js';
import { loadConfig } from './config.js';

// 진입점은 최대한 얇게 둔다. 실제 기능은 모듈별로 나눠서,
// 나중에 명령어가 늘어나도 이 파일이 다시 커지지 않게 한다.
const config = loadConfig(process.env);
const lifeAgent = createLifeAgentBot(config);

lifeAgent
  .start()
  .then(() => {
    console.log('Life Agent Bot started.');
    console.log(`FAST_MODEL=${config.fastModel}`);
    console.log(`DEEP_MODEL=${config.deepModel}`);
    console.log(`CODE_MODEL=${config.codeModel}`);
    console.log(`VISION_MODEL=${config.visionModel}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
