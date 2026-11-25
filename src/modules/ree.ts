/** Public, source-traceable content. Never add answer keys or explanations here. */
export const REE_MODULE_ID = 'eaab8a50-243b-4ea6-a8d4-59c58120ef01';
export const REE_MODULE_KEY = 'ielts-speaking-simple-answer-development-part-1';
export const REE_VERSION = 1;
export const STAGES = ['Discover', 'Learn', 'Practice', 'Apply', 'Reflect', 'Verify'] as const;
export type Stage = (typeof STAGES)[number];

export interface ChoiceQuestion {
  id: string;
  prompt: string;
  studentResponse: string;
  options: { id: string; text: string }[];
}

export interface ModuleManifest {
  id: string;
  key: string;
  version: number;
  title: string;
  level: string;
  skill: string;
  minutes: number;
  outcome: string;
  prerequisites: string[];
  source: { url: string; revision: string; author: string };
  stages: typeof STAGES;
  stageMinutes: Record<Stage, number>;
  discoverPrompt: string;
  learn: {
    introduction: string[];
    layers: { label: string; text: string; language: string }[];
    respondByQuestion: { kind: string; method: string; example: string }[];
    examples: { label: string; question: string; before: string; after: string[] }[];
    conclusion: string;
  };
  practice: {
    introduction: string;
    mcq: { title: string; instruction: string; questions: ChoiceQuestion[] };
    matching: {
      title: string;
      instruction: string;
      responds: { id: string; text: string }[];
      explains: { id: string; text: string }[];
      examples: { id: string; text: string }[];
      conclusion: string;
    };
  };
  apply: { introduction: string; prompts: { id: string; text: string }[]; reminder: string[] };
  reflect: { introduction: string; items: string[] };
  verify: { introduction: string; prompt: string; guidance: string[] };
  rubric: { id: string; title: string; anchors: [string, string, string] }[];
  mastery: { minimumScore: number; noZero: true; minSeconds: number; maxSeconds: number };
  assets: { id: string; stage: Stage; kind: 'audio' | 'video'; url: string; verified: boolean }[];
  missingAssets: { id: string; stage: 'Learn'; description: string }[];
}

export const reeManifest: ModuleManifest = {
  id: REE_MODULE_ID,
  key: REE_MODULE_KEY,
  version: REE_VERSION,
  title: 'Simple Answer Development (Part 1)',
  level: 'B1',
  skill: 'IELTS Speaking Part 1',
  minutes: 21,
  outcome: 'Sau module này, bạn trả lời được mỗi câu Part 1 trong 20–30 giây theo 3 bước Respond → Explain → Example (REE), ý sau bám ý đầu.',
  prerequisites: [],
  source: {
    url: 'https://simpclub.sharepoint.com/sites/E-MasterLanguagesCenter-Micro-ModuleIELTSCoachingProject/_layouts/15/Doc.aspx?sourcedoc=%7BF823F0D3-9D72-4FB2-9DD0-035B09D5919F%7D',
    revision: 'SharePoint modified 2026-11-23T01:37:43Z; source dated Nov 12, 2026',
    author: 'Josh',
  },
  stages: STAGES,
  stageMinutes: { Discover: 1, Learn: 6, Practice: 6, Apply: 4, Reflect: 2, Verify: 2 },
  discoverPrompt: 'Where do you enjoy visiting in your free time?',
  learn: {
    introduction: [
      'Bạn học REE (Respond, Explain, Example) và cách Respond khác nhau cho câu hỏi Yes/No và câu hỏi thông tin.',
      'Hình ảnh củ hành: câu trả lời có nhiều lớp, vào càng sâu càng chi tiết. Respond (ý chung) → Explain (chi tiết hỗ trợ ý chung) → Example (trải nghiệm thực tế).',
      'Cách làm: giữ từ khóa của câu hỏi, đổi thành câu khẳng định, rồi đặt thông tin trả lời ở chỗ cuối câu.',
      'Which season do you like best? → The season that I like best is summer.',
      'How often do you go swimming? → I go swimming about twice a week.',
      'Cách nhớ nhanh: đưa từ để hỏi xuống cuối câu rồi đổi thành câu trả lời của bạn.',
    ],
    layers: [
      { label: 'Respond', text: 'Trả lời ngắn, trực tiếp (cách làm theo dạng câu hỏi, xem bảng dưới)', language: 'Yes / No, I always / often / never, Probably… hoặc paraphrase lại câu hỏi' },
      { label: 'Explain', text: 'Nêu lý do (cách giải thích phổ biến nhất)', language: 'not only… but also…; this is because / due to; the main reason is…' },
      { label: 'Example', text: 'Kể một sự việc đã xảy ra với bạn (quá khứ hoặc hiện tại), liên quan đến phần Explain', language: 'for example, for instance, take… for example' },
    ],
    respondByQuestion: [
      { kind: 'Yes/No', method: 'Trả lời thẳng: Yes / No, I always / often / never, Probably…', example: 'Do you like cycling? → Yes, I do. / Probably.' },
      { kind: 'Câu hỏi thông tin (Which / What / Where / Who/ Why/ When/ How…)', method: 'Cách dễ nhất: paraphrase lại câu hỏi, đặt thông tin cần trả lời ở cuối câu', example: 'Which subject do you enjoy learning the most at school? → The subject that I like to learn about the most at school is literature.' },
    ],
    examples: [
      { label: 'Cặp 1, câu hỏi Yes/No', question: 'Do you like listening to music?', before: 'Yes, I do. I like music.', after: [
        '[R] Yes, I do. I listen to music almost every day.',
        '[E] The main reason is that it helps me relax after a long day at school.',
        '[Ex] For example, last week I had a difficult maths test, so I listened to my favourite playlist on the bus before the exam. I felt much calmer.',
      ] },
      { label: 'Cặp 2, câu hỏi mở', question: 'Which subject do you enjoy learning the most at school?', before: 'Literature.', after: [
        '[R] The subject that I like to learn about the most at school is literature.',
        '[E] This is because the stories help me understand how other people think and feel.',
        '[Ex] For example, last month we read a short story about a boy who moved to a new city, and I understood how lonely he felt.',
      ] },
    ],
    conclusion: 'Một câu trả lời tốt có 3 bước: Respond (trả lời thẳng câu hỏi), Explain (nêu một lý do), Example (kể một việc cụ thể gắn với lý do đó). Ý sau luôn bám ý trước.',
  },
  practice: {
    introduction: 'Practice có hai bài: trắc nghiệm để phân biệt Explain và Example, và matching để chọn đúng detail bám ý. Làm hết từng bài rồi mới xem đáp án. Sai câu nào, đọc giải thích rồi thử lại câu đó.',
    mcq: {
      title: 'Bài 1. Trắc nghiệm (6 câu)',
      instruction: 'Bài làm: mỗi câu có câu hỏi và câu trả lời. Chọn từ/cụm đúng cho chỗ trống trong câu trả lời, rồi ghi câu đó thuộc bước nào: Explain hay Example.',
      questions: [
        { id: '1', prompt: 'Giám khảo: How often do you help your parents at home?', studentResponse: 'Bạn: I help my parents about three times a week. ____, last Sunday I washed the dishes and cleaned the kitchen.', options: [{ id: 'A', text: 'This is because' }, { id: 'B', text: 'The main reason is' }, { id: 'C', text: 'For example' }] },
        { id: '2', prompt: 'Giám khảo: What kind of music do you like the most?', studentResponse: 'Bạn: The kind of music that I like the most is pop. ____ it makes me feel happy.', options: [{ id: 'A', text: 'The main reason is that' }, { id: 'B', text: 'For example,' }, { id: 'C', text: 'For instance,' }] },
        { id: '3', prompt: 'Giám khảo: Do you like rainy days?', studentResponse: "Bạn: No, I don't. ____ it is difficult to go out and meet my friends.", options: [{ id: 'A', text: 'For instance,' }, { id: 'B', text: 'Take last week, for example,' }, { id: 'C', text: 'This is because' }] },
        { id: '4', prompt: 'Giám khảo: Do you enjoy learning new languages?', studentResponse: 'Bạn: Yes, I do. Take Korean, ____. Last year I learned some words from my favourite songs.', options: [{ id: 'A', text: 'because' }, { id: 'B', text: 'for example' }, { id: 'C', text: 'due to' }] },
        { id: '5', prompt: 'Giám khảo: How do you usually get to school?', studentResponse: 'Bạn: I usually go to school by bike. ____, yesterday I left home at 6:30 and arrived five minutes early.', options: [{ id: 'A', text: 'For instance' }, { id: 'B', text: 'This is because' }, { id: 'C', text: 'The main reason is' }] },
        { id: '6', prompt: 'Giám khảo: Do you like playing football?', studentResponse: 'Bạn: Yes, I do. Playing football is ____ fun, ____ good for my health.', options: [{ id: 'A', text: 'for example … for instance' }, { id: 'B', text: 'not only … but also' }, { id: 'C', text: 'take … for example' }] },
      ],
    },
    matching: {
      title: 'Bài 2. Matching R / E / Ex (4 bộ)',
      instruction: 'Bài làm: nối mỗi Respond (1–4) với 1 Explain (A–D) và 1 Example (i–iv) để tạo thành câu trả lời bám ý. Mục đích: hiểu detail phải liên quan và hỗ trợ ý đầu.',
      responds: [
        { id: '1', text: 'Do you shop online a lot? → I rarely shop online.' },
        { id: '2', text: 'How often do you read? → I read a book almost every night.' },
        { id: '3', text: 'Do you buy things online? → I often buy things online.' },
        { id: '4', text: 'Where do you watch films most often? → I often watch films at home.' },
      ],
      explains: [
        { id: 'A', text: 'This is because reading helps me relax before I go to sleep.' },
        { id: 'B', text: 'It is not only quick, but also cheaper than shops in town.' },
        { id: 'C', text: 'The main reason is that it is a good way to spend time with my family.' },
        { id: 'D', text: 'This is because I prefer to try clothes on before I buy them.' },
      ],
      examples: [
        { id: 'i', text: 'For instance, last Sunday we watched a comedy together and talked about it all evening.' },
        { id: 'ii', text: 'For example, last year I bought a jacket online, but it was too small, so I had to return it.' },
        { id: 'iii', text: 'For example, last night I read a funny story for twenty minutes and fell asleep quickly.' },
        { id: 'iv', text: 'Take last week, for example. I bought a pair of shoes in five minutes, and they were cheaper than in any shop in town.' },
      ],
      conclusion: 'Nguyên tắc rút ra: detail tốt phải cùng chủ đề, cùng hướng với Respond, và chứng minh đúng lý do vừa nêu, chứ không chỉ "có liên quan".',
    },
  },
  apply: {
    introduction: 'Bạn ghi âm 3 câu Part 1 mới, mỗi câu 20–30 giây, và mỗi câu phải là một câu trả lời đạt: đủ R-E-E, ý sau bám ý trước.',
    prompts: [
      { id: 'apply-1', text: 'Where is your favourite place to hang out with friends in your hometown?' },
      { id: 'apply-2', text: 'How often do you eat your favourite food?' },
      { id: 'apply-3', text: 'What activities do you do with your close friends in your free time?' },
    ],
    reminder: [
      'Respond: Yes / No, I always / often / never, Probably… hoặc paraphrase lại câu hỏi, đặt thông tin ở cuối câu.',
      'Explain: this is because / due to; the main reason is…; not only… but also…',
      'Example: for example, for instance, take… for example.',
    ],
  },
  reflect: {
    introduction: 'Sau khi ghi âm, bạn tự đối chiếu với checklist 5 mục. Tích vào mục nào đúng với bạn; mục nào chưa tích là điểm bạn cần luyện thêm.',
    items: [
      'Tôi trả lời thẳng câu hỏi ngay câu đầu (Respond).',
      'Tôi nêu được một lý do rõ ràng (Explain).',
      'Tôi kể một ví dụ cụ thể, gắn với lý do vừa nêu (Example).',
      'Ý sau bám ý trước, mỗi câu trả lời dài khoảng 20–30 giây.',
      'Chỉ để tự cảm nhận, không tính điểm: so với bản ghi ở Discover, tôi nói dài hơn và rõ hơn.',
    ],
  },
  verify: {
    introduction: 'Bạn trả lời lại câu hỏi ở Discover, rồi nộp bản ghi âm để coach chấm.',
    prompt: 'Where do you enjoy visiting in your free time?',
    guidance: [
      'Trả lời theo chuẩn "một câu trả lời đạt": đủ R-E-E, chi tiết bổ trợ ý chính, dài 20–30 giây.',
      'Kiểm tra lại các file ghi âm trước khi nộp.',
      'Nộp theo hướng dẫn của coach. Coach có thể đối chiếu bản này với bản bạn ghi ở Discover.',
    ],
  },
  rubric: [
    { id: 'respond', title: 'Respond', anchors: ['Không trả lời thẳng', 'Có trả lời nhưng dài dòng hoặc mơ hồ', 'Ngắn, trực tiếp'] },
    { id: 'explain', title: 'Explain', anchors: ['Không có lý do', 'Có lý do nhưng chung chung', 'Lý do rõ, hỗ trợ Respond'] },
    { id: 'example', title: 'Example', anchors: ['Không có ví dụ', 'Có nhưng không gắn với Explain', 'Ví dụ cụ thể, gắn với Explain'] },
    { id: 'coherence', title: 'Bám ý', anchors: ['Các phần rời rạc', 'Bám một phần', 'Các phần nối tiếp nhau'] },
  ],
  mastery: { minimumScore: 6, noZero: true, minSeconds: 20, maxSeconds: 30 },
  assets: [],
  missingAssets: [
    { id: 'learn-audio-music', stage: 'Learn', description: 'Audio mẫu bản “Sau” cho Do you like listening to music? (~22–27 giây)' },
    { id: 'learn-audio-literature', stage: 'Learn', description: 'Audio mẫu bản “Sau” cho Which subject do you enjoy learning the most at school? (~22–27 giây)' },
  ],
};

export function validateModuleManifest(manifest: ModuleManifest): string[] {
  const errors: string[] = [];
  if (manifest.stages.join('|') !== STAGES.join('|')) errors.push('Six stages must retain their fixed order');
  if (!manifest.id || !manifest.key || manifest.version < 1 || !manifest.source.url) errors.push('Missing identity or source');
  const ids = [
    ...manifest.practice.mcq.questions.map((question) => question.id),
    ...manifest.practice.matching.responds.map((item) => `matching-${item.id}`),
    ...manifest.apply.prompts.map((prompt) => prompt.id),
  ];
  if (new Set(ids).size !== ids.length) errors.push('Duplicate interaction ID');
  if (manifest.discoverPrompt !== manifest.verify.prompt) errors.push('Verify must repeat Discover prompt');
  if (JSON.stringify(manifest).match(/"correct"\s*:|"explanation"\s*:|"answerKey"\s*:/)) errors.push('Private keys cannot appear in public manifest');
  if (manifest.missingAssets.some((asset) => asset.stage !== 'Learn')) errors.push('Lesson media belongs in Learn');
  if (manifest.assets.some((asset) => asset.kind === 'video' && asset.stage !== 'Learn')) {
    errors.push('Video lessons belong in Learn only');
  }
  if (manifest.assets.some((asset) => !asset.verified || !asset.url)) {
    errors.push('Media must have a verified URL');
  }
  return errors;
}
