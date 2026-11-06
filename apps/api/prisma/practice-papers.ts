export type GeneratedOption = { id: string; text: string };

export type GeneratedQuestion = {
  questionNumber: number;
  text: string;
  options: GeneratedOption[];
  correctOptionId: string | null;
  correctOptionIds?: string[];
  correctNumericalAnswer?: number | null;
  numericalTolerance?: number | null;
  type?: "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERICAL";
  explanation: string;
  subjectTag: string;
  topicTag: string;
  marks: number;
  negativeMarks: number;
  sourceConfidence: number;
};

const OPTION_IDS = ["A", "B", "C", "D"] as const;

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function pack(
  text: string,
  correct: string,
  wrong: string[],
  explanation: string,
  topicTag: string,
  seed: number,
): Omit<GeneratedQuestion, "questionNumber" | "subjectTag" | "marks" | "negativeMarks" | "sourceConfidence"> {
  const values: string[] = [];
  for (const value of [correct, ...wrong]) {
    const clean = String(value).trim();
    if (clean && !values.includes(clean)) values.push(clean);
  }
  for (const fallback of ["None of these", "Cannot be determined", "Data insufficient", "All of these"]) {
    if (values.length >= 4) break;
    if (!values.includes(fallback)) values.push(fallback);
  }

  const offset = Math.abs(seed) % 4;
  const ordered = [...values.slice(offset), ...values.slice(0, offset)];
  const correctOptionId = OPTION_IDS[ordered.indexOf(String(correct).trim())] ?? "A";

  return {
    text,
    options: ordered.map((value, index) => ({ id: OPTION_IDS[index], text: value })),
    correctOptionId,
    explanation,
    topicTag,
  };
}

function quantQuestion(seed: number) {
  const n = Math.abs(seed);
  const template = n % 18;

  if (template === 0) {
    const rate = 5 + (n % 16) * 5;
    const base = 120 + (n % 40) * 10;
    const answer = (rate * base) / 100;
    return pack(
      `What is ${rate}% of ${base}?`,
      formatNumber(answer),
      [formatNumber(answer + 5), formatNumber(answer - 5), formatNumber(answer * 2)],
      `${rate}% of ${base} = (${rate}/100) x ${base} = ${formatNumber(answer)}.`,
      "Percentage",
      seed,
    );
  }

  if (template === 1) {
    const cost = 100 + (n % 30) * 10;
    const profit = 5 + (n % 8) * 5;
    const selling = cost * (1 + profit / 100);
    return pack(
      `An article bought for Rs ${cost} is sold for Rs ${formatNumber(selling)}. Find the profit percentage.`,
      `${profit}%`,
      [`${profit + 5}%`, `${Math.max(1, profit - 5)}%`, `${profit + 10}%`],
      `Profit = ${formatNumber(selling - cost)}. Profit % = (${formatNumber(selling - cost)}/${cost}) x 100 = ${profit}%.`,
      "Profit and Loss",
      seed,
    );
  }

  if (template === 2) {
    const principal = 1000 + (n % 12) * 500;
    const rate = 4 + (n % 6);
    const years = 2 + (n % 4);
    const interest = (principal * rate * years) / 100;
    return pack(
      `Find the simple interest on Rs ${principal} at ${rate}% per annum for ${years} years.`,
      `Rs ${formatNumber(interest)}`,
      [`Rs ${formatNumber(interest + 100)}`, `Rs ${formatNumber(interest - 100)}`, `Rs ${formatNumber(interest * 2)}`],
      `SI = P x R x T / 100 = ${principal} x ${rate} x ${years} / 100 = Rs ${formatNumber(interest)}.`,
      "Simple Interest",
      seed,
    );
  }

  if (template === 3) {
    const principal = 1000 + (n % 8) * 1000;
    const interest = principal * 0.21;
    return pack(
      `Find the compound interest on Rs ${principal} at 10% per annum for 2 years.`,
      `Rs ${formatNumber(interest)}`,
      [`Rs ${formatNumber(interest + 100)}`, `Rs ${formatNumber(interest - 100)}`, `Rs ${formatNumber(principal * 0.2)}`],
      `Amount = P(1 + R/100)^2 = ${principal} x 1.21. CI = ${formatNumber(interest)}.`,
      "Compound Interest",
      seed,
    );
  }

  if (template === 4) {
    const a = 10 + (n % 20);
    const b = a + 4 + (n % 6);
    const c = a + 8 + (n % 8);
    const average = (a + b + c) / 3;
    return pack(
      `Find the average of ${a}, ${b} and ${c}.`,
      formatNumber(average),
      [formatNumber(average + 2), formatNumber(average - 2), formatNumber(average + 4)],
      `Average = (${a} + ${b} + ${c}) / 3 = ${formatNumber(average)}.`,
      "Average",
      seed,
    );
  }

  if (template === 5) {
    const total = 120 + (n % 20) * 10;
    const smaller = (total * 2) / 5;
    return pack(
      `Rs ${total} is divided between A and B in the ratio 2 : 3. How much does A receive?`,
      `Rs ${formatNumber(smaller)}`,
      [`Rs ${formatNumber(smaller + 10)}`, `Rs ${formatNumber(smaller - 10)}`, `Rs ${formatNumber((total * 3) / 5)}`],
      `A's share = (2/5) x ${total} = Rs ${formatNumber(smaller)}.`,
      "Ratio and Proportion",
      seed,
    );
  }

  if (template === 6) {
    const pairs = [
      [10, 15, 6],
      [12, 24, 8],
      [15, 30, 10],
      [20, 30, 12],
      [6, 12, 4],
      [8, 24, 6],
    ];
    const [a, b, together] = pairs[n % pairs.length];
    return pack(
      `A can finish a work in ${a} days and B in ${b} days. Working together, they finish it in how many days?`,
      `${together} days`,
      [`${together + 1} days`, `${together - 1} days`, `${together + 2} days`],
      `Together = 1/(1/${a} + 1/${b}) = ${together} days.`,
      "Time and Work",
      seed,
    );
  }

  if (template === 7) {
    const distance = 60 + (n % 12) * 10;
    const time = 0.5 + (n % 4) * 0.5;
    const speed = distance / time;
    return pack(
      `A car covers ${distance} km in ${formatNumber(time)} hours. Find its average speed.`,
      `${formatNumber(speed)} km/h`,
      [`${formatNumber(speed + 10)} km/h`, `${formatNumber(speed - 10)} km/h`, `${formatNumber(speed * 2)} km/h`],
      `Speed = distance / time = ${distance} / ${formatNumber(time)} = ${formatNumber(speed)} km/h.`,
      "Speed, Time and Distance",
      seed,
    );
  }

  if (template === 8) {
    const length = 100 + (n % 10) * 20;
    const speed = 10 + (n % 5) * 2;
    const time = length / speed;
    return pack(
      `A train ${length} m long crosses a pole at ${speed} m/s. How long does it take?`,
      `${formatNumber(time)} seconds`,
      [`${formatNumber(time + 2)} seconds`, `${formatNumber(time - 2)} seconds`, `${formatNumber(time + 4)} seconds`],
      `Time = length / speed = ${length} / ${speed} = ${formatNumber(time)} seconds.`,
      "Trains",
      seed,
    );
  }

  if (template === 9) {
    const boat = 10 + (n % 6);
    const stream = 2 + (n % 3);
    return pack(
      `A boat travels at ${boat} km/h in still water and the stream flows at ${stream} km/h. Find the downstream speed.`,
      `${boat + stream} km/h`,
      [`${boat - stream} km/h`, `${boat} km/h`, `${boat + stream + 2} km/h`],
      `Downstream speed = boat speed + stream speed = ${boat + stream} km/h.`,
      "Boats and Streams",
      seed,
    );
  }

  if (template === 10) {
    const pairs = [
      [12, 18, 36],
      [15, 25, 75],
      [16, 24, 48],
      [18, 30, 90],
      [20, 30, 60],
    ];
    const [a, b, lcm] = pairs[n % pairs.length];
    return pack(
      `Find the LCM of ${a} and ${b}.`,
      String(lcm),
      [String(lcm + 6), String(lcm - 6), String(a * b * 2)],
      `LCM of ${a} and ${b} is ${lcm}.`,
      "HCF and LCM",
      seed,
    );
  }

  if (template === 11) {
    const value = 100 + (n % 80);
    const remainder = value % 9;
    const add = remainder === 0 ? 0 : 9 - remainder;
    return pack(
      `What is the smallest number that must be added to ${value} to make it divisible by 9?`,
      String(add),
      [String(add + 1), String(add + 2), String(Math.max(0, add - 1))],
      `${value} leaves remainder ${remainder} when divided by 9. Add ${add} to reach the next multiple of 9.`,
      "Number System",
      seed,
    );
  }

  if (template === 12) {
    const length = 8 + (n % 12);
    const breadth = 5 + (n % 8);
    const area = length * breadth;
    return pack(
      `Find the area of a rectangle with length ${length} m and breadth ${breadth} m.`,
      `${area} sq m`,
      [`${area + length} sq m`, `${area - breadth} sq m`, `${2 * (length + breadth)} sq m`],
      `Area = length x breadth = ${length} x ${breadth} = ${area} sq m.`,
      "Mensuration",
      seed,
    );
  }

  if (template === 13) {
    const cases: Array<[string, string, string[]]> = [
      ["A die is rolled once. What is the probability of getting an even number?", "1/2", ["1/3", "1/6", "2/3"]],
      ["A die is rolled once. What is the probability of getting a number greater than 4?", "1/3", ["1/2", "1/6", "2/3"]],
      ["A coin is tossed once. What is the probability of getting a head?", "1/2", ["1/3", "1/4", "2/3"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Count the favourable outcomes and divide by the total outcomes.", "Probability", seed);
  }

  if (template === 14) {
    const son = 10 + (n % 15);
    const father = son + 25 + (n % 10);
    return pack(
      `A father is ${father} years old and his son is ${son} years old. After how many years will the father be twice as old as the son?`,
      `${father - 2 * son} years`,
      [`${father - 2 * son + 2} years`, `${father - 2 * son + 5} years`, `${father - 2 * son - 2} years`],
      `Let the number of years be x. ${father} + x = 2(${son} + x), so x = ${father - 2 * son}.`,
      "Ages",
      seed,
    );
  }

  if (template === 15) {
    const a = 2 + (n % 6);
    const b = 3 + (n % 5);
    const c = 4 + (n % 4);
    const answer = a + b * c;
    return pack(
      `Simplify: ${a} + ${b} x ${c}.`,
      String(answer),
      [String((a + b) * c), String(answer + 2), String(answer - 2)],
      `Using BODMAS, multiply first: ${b} x ${c} = ${b * c}. Then add ${a}: ${answer}.`,
      "Simplification",
      seed,
    );
  }

  if (template === 16) {
    const value = 3 + (n % 5);
    const answer = value * value - 2;
    return pack(
      `If x + 1/x = ${value}, what is x^2 + 1/x^2?`,
      String(answer),
      [String(answer + 1), String(answer + 2), String(value * value)],
      `x^2 + 1/x^2 = (x + 1/x)^2 - 2 = ${value}^2 - 2 = ${answer}.`,
      "Algebra",
      seed,
    );
  }

  const principal = 2000 + (n % 10) * 1000;
  const ratioA = 2 + (n % 4);
  const ratioB = 3 + (n % 5);
  const share = (principal * ratioA) / (ratioA + ratioB);
  return pack(
    `A and B invest in the ratio ${ratioA} : ${ratioB}. If the total profit is Rs ${principal}, find A's share.`,
    `Rs ${formatNumber(share)}`,
    [`Rs ${formatNumber(share + 100)}`, `Rs ${formatNumber(share - 100)}`, `Rs ${formatNumber(principal - share)}`],
    `A's share = (${ratioA}/${ratioA + ratioB}) x ${principal} = Rs ${formatNumber(share)}.`,
    "Partnership",
    seed,
  );
}

function reasoningQuestion(seed: number) {
  const n = Math.abs(seed);
  const template = n % 22;

  if (template === 0) {
    const start = 2 + (n % 8);
    const diff = 3 + (n % 5);
    const terms = [start, start + diff, start + 2 * diff, start + 3 * diff, start + 4 * diff];
    const answer = start + 5 * diff;
    return pack(
      `Find the next term: ${terms.join(", ")}, ?`,
      String(answer),
      [String(answer + diff), String(answer - diff), String(answer + 1)],
      `The series increases by ${diff} each time, so the next term is ${answer}.`,
      "Number Series",
      seed,
    );
  }

  if (template === 1) {
    const cases: Array<[string, string, string[]]> = [
      ["A, C, E, G, ?", "I", ["H", "J", "K"]],
      ["B, D, F, H, ?", "J", ["I", "K", "L"]],
      ["Z, X, V, T, ?", "R", ["S", "Q", "P"]],
      ["C, F, I, L, ?", "O", ["N", "P", "M"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(`Find the next letter: ${text}`, correct, wrong, "Track the fixed gap between consecutive letters.", "Alphabet Series", seed);
  }

  if (template === 2) {
    const cases: Array<[string, string, string[]]> = [
      ["Find the odd one out: 4, 9, 16, 25, 30", "30", ["4", "16", "25"]],
      ["Find the odd one out: 2, 3, 5, 7, 11, 15", "15", ["2", "7", "11"]],
      ["Find the odd one out: 8, 27, 64, 100, 125", "100", ["8", "27", "125"]],
      ["Find the odd one out: 12, 18, 24, 30, 35", "35", ["12", "24", "30"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "All other numbers follow the same pattern.", "Odd One Out", seed);
  }

  if (template === 3) {
    const shift = 1 + (n % 2);
    const word = ["CAT", "DOG", "SUN", "MAP"][n % 4];
    const coded = word
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) + shift))
      .join("");
    return pack(
      `If each letter is shifted ${shift} place${shift > 1 ? "s" : ""} forward, how is ${word} coded?`,
      coded,
      [coded.split("").reverse().join(""), coded.replace(/./g, (char) => String.fromCharCode(char.charCodeAt(0) + 1)), word],
      `Shift each letter of ${word} by ${shift}: ${coded}.`,
      "Coding-Decoding",
      seed,
    );
  }

  if (template === 4) {
    const cases: Array<[string, string, string[]]> = [
      ["Pointing to a man, a woman said, 'He is the son of my mother's only son.' How is the man related to the woman?", "Nephew", ["Son", "Brother", "Cousin"]],
      ["A is B's father. C is B's sister. How is A related to C?", "Father", ["Brother", "Uncle", "Grandfather"]],
      ["P is the mother of Q. Q is the sister of R. How is P related to R?", "Mother", ["Aunt", "Sister", "Grandmother"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Trace each relation one step at a time.", "Blood Relations", seed);
  }

  if (template === 5) {
    const north = 3 + (n % 5);
    const east = 2 + (n % 4);
    return pack(
      `A person walks ${north} km north, turns right and walks ${east} km. How far and in which direction is he from the start?`,
      `${east} km east and ${north} km north`,
      [`${north} km east and ${east} km north`, `${east + north} km north-east`, `${east} km west`],
      `The final position is ${north} km north and ${east} km east of the start.`,
      "Direction Sense",
      seed,
    );
  }

  if (template === 6) {
    const cases: Array<[string, string, string[]]> = [
      ["All roses are flowers. Some flowers fade quickly. Which conclusion follows?", "Some roses may fade quickly", ["All roses fade quickly", "No rose fades quickly", "All flowers are roses"]],
      ["All pens are books. No book is a pencil. Which conclusion follows?", "No pen is a pencil", ["Some pens are pencils", "All pencils are pens", "Some books are pencils"]],
      ["Some doctors are teachers. All teachers are graduates. Which conclusion follows?", "Some doctors are graduates", ["All doctors are graduates", "No doctor is a graduate", "All graduates are doctors"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Apply the standard syllogism rules; do not assume more than the statements say.", "Syllogism", seed);
  }

  if (template === 7) {
    const cases: Array<[string, string, string[]]> = [
      ["Doctor : Hospital :: Teacher : ?", "School", ["Book", "Student", "Class"]],
      ["Pen : Write :: Knife : ?", "Cut", ["Sharp", "Metal", "Kitchen"]],
      ["Bird : Nest :: Bee : ?", "Hive", ["Flower", "Honey", "Tree"]],
      ["Book : Pages :: Ladder : ?", "Rungs", ["Wood", "Height", "Steps"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Find the same relationship in the second pair.", "Analogy", seed);
  }

  if (template === 8) {
    const total = 20 + (n % 20);
    const topRank = 5 + (n % 10);
    const answer = total - topRank + 1;
    return pack(
      `In a class of ${total} students, A is ${topRank}th from the top. What is A's rank from the bottom?`,
      String(answer),
      [String(answer + 1), String(answer - 1), String(total - topRank)],
      `Rank from bottom = total - rank from top + 1 = ${total} - ${topRank} + 1 = ${answer}.`,
      "Ranking",
      seed,
    );
  }

  if (template === 9) {
    const hour = 1 + (n % 12);
    const minute = (n % 4) * 15;
    const angle = Math.abs(30 * hour - 5.5 * minute);
    const smaller = Math.min(angle, 360 - angle);
    return pack(
      `What is the angle between the hour and minute hands at ${hour}:${String(minute).padStart(2, "0")}?`,
      `${formatNumber(smaller)} degrees`,
      [`${formatNumber(smaller + 10)} degrees`, `${formatNumber(smaller - 10)} degrees`, `${formatNumber(180 - smaller)} degrees`],
      `Angle = |30H - 5.5M| = |30 x ${hour} - 5.5 x ${minute}| = ${formatNumber(angle)}. The smaller angle is ${formatNumber(smaller)} degrees.`,
      "Clocks",
      seed,
    );
  }

  if (template === 10) {
    const days = 30 + (n % 50);
    const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const start = names[n % 7];
    const answer = names[(n % 7 + days) % 7];
    return pack(
      `If today is ${start}, what day will it be after ${days} days?`,
      answer,
      names.filter((day) => day !== answer).slice(0, 3),
      `${days} mod 7 = ${days % 7}. Move ${days % 7} days forward from ${start} to get ${answer}.`,
      "Calendar",
      seed,
    );
  }

  if (template === 11) {
    const cases: Array<[string, string, string[]]> = [
      ["A is taller than B. C is taller than A. Who is the tallest?", "C", ["A", "B", "Cannot be determined"]],
      ["A > B, B >= C, C = D. Which relation is definitely true?", "A > D", ["D > A", "B < D", "A = C"]],
      ["P is heavier than Q but lighter than R. Who is the heaviest?", "R", ["P", "Q", "Cannot be determined"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Combine the inequalities or comparisons step by step.", "Inequality", seed);
  }

  if (template === 12) {
    const cases: Array<[string, string, string[]]> = [
      ["A cube is painted on all faces and cut into 27 equal smaller cubes. How many smaller cubes have no face painted?", "1", ["6", "8", "12"]],
      ["A cube is painted on all faces and cut into 27 equal smaller cubes. How many have exactly one face painted?", "6", ["1", "8", "12"]],
      ["A cube is painted on all faces and cut into 27 equal smaller cubes. How many have exactly two faces painted?", "12", ["6", "8", "1"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "For a 3 x 3 x 3 cube, use the standard painted-cube counts.", "Cubes", seed);
  }

  if (template === 13) {
    const cases: Array<[string, string, string[]]> = [
      ["Which word can be formed using the letters of 'TRANSPORT'?", "SPORT", ["TRAIN", "PLANT", "STONE"]],
      ["Which word can be formed using the letters of 'EDUCATION'?", "ACTION", ["NATION", "DENTAL", "CIRCLE"]],
      ["Which word can be formed using the letters of 'GOVERNMENT'?", "MENTOR", ["MAGNET", "GARDEN", "ENGINE"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Check each option against the available letters and their counts.", "Word Formation", seed);
  }

  if (template === 14) {
    const position = 5 + (n % 15);
    const offset = 3 + (n % 5);
    const target = position + offset;
    const letter = String.fromCharCode(64 + Math.min(26, target));
    return pack(
      `Which letter is ${offset}th to the right of the ${position}th letter from the left in the English alphabet?`,
      letter,
      [String.fromCharCode(64 + Math.max(1, target - 1)), String.fromCharCode(64 + Math.min(26, target + 1)), String.fromCharCode(64 + Math.max(1, position - offset))],
      `Target position = ${position} + ${offset} = ${target}, which is ${letter}.`,
      "Alphabet Test",
      seed,
    );
  }

  if (template === 15) {
    const cases: Array<[string, string, string[]]> = [
      ["Statements: All chairs are tables. All tables are furniture. Conclusion?", "All chairs are furniture", ["Some furniture is not a table", "No chair is furniture", "All furniture is a chair"]],
      ["Statements: Some apples are red. All red things are sweet. Conclusion?", "Some apples are sweet", ["All apples are sweet", "No apple is sweet", "All sweet things are apples"]],
      ["Statements: No cat is a dog. Some dogs are pets. Conclusion?", "Some pets are not cats", ["All pets are cats", "No pet is a cat", "All dogs are cats"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Use only the given statements and a valid conclusion.", "Statement and Conclusion", seed);
  }

  if (template === 16) {
    const cases: Array<[string, string, string[]]> = [
      ["A die has opposite faces adding to 7. If 3 is on top, what is at the bottom?", "4", ["3", "5", "6"]],
      ["A die has opposite faces adding to 7. If 2 is on top, what is at the bottom?", "5", ["3", "4", "6"]],
      ["A die has opposite faces adding to 7. If 6 is on top, what is at the bottom?", "1", ["2", "3", "5"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Opposite faces of a standard die sum to 7.", "Dice", seed);
  }

  if (template === 17) {
    const cases: Array<[string, string, string[]]> = [
      ["Which one is different: circle, square, triangle, cube?", "Cube", ["Circle", "Square", "Triangle"]],
      ["Which one is different: copper, iron, wood, silver?", "Wood", ["Copper", "Iron", "Silver"]],
      ["Which one is different: January, March, May, June?", "June", ["January", "March", "May"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Classify the items and find the one that does not fit.", "Classification", seed);
  }

  if (template === 18) {
    const cases: Array<[string, string, string[]]> = [
      ["If SOUTH is coded as TPVUI, how is NORTH coded?", "OPSUI", ["OPSUJ", "MPSUI", "OQSUI"]],
      ["If EAST is coded as FBTU, how is WEST coded?", "XFTU", ["XFTV", "VFTU", "XETU"]],
      ["If CAT is coded as DBU, how is DOG coded?", "EPH", ["EPG", "DPH", "FQI"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Each letter is shifted forward by one position.", "Coding-Decoding", seed);
  }

  if (template === 19) {
    const cases: Array<[string, string, string[]]> = [
      ["A man walks 4 km south, turns left and walks 3 km. Which direction is he facing now?", "East", ["West", "North", "South"]],
      ["A woman walks 5 km east, turns right and walks 2 km. Which direction is she facing now?", "South", ["North", "East", "West"]],
      ["A boy walks 6 km north, turns left and walks 4 km. Which direction is he facing now?", "West", ["East", "North", "South"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Track the turns relative to the current direction.", "Direction Sense", seed);
  }

  if (template === 20) {
    const cases: Array<[string, string, string[]]> = [
      ["Find the missing term: 2, 6, 12, 20, 30, ?", "42", ["40", "44", "36"]],
      ["Find the missing term: 1, 4, 9, 16, 25, ?", "36", ["30", "35", "49"]],
      ["Find the missing term: 3, 8, 15, 24, ?", "35", ["32", "36", "30"]],
    ];
    const [text, correct, wrong] = cases[n % cases.length];
    return pack(text, correct, wrong, "Look at the differences between consecutive terms.", "Number Series", seed);
  }

  const cases: Array<[string, string, string[]]> = [
    ["Which number is divisible by both 3 and 5?", "45", ["35", "40", "50"]],
    ["Which number is a prime number?", "29", ["21", "27", "33"]],
    ["Which number is a perfect square?", "144", ["124", "136", "148"]],
  ];
  const [text, correct, wrong] = cases[n % cases.length];
  return pack(text, correct, wrong, "Check the divisibility or number property in the options.", "Number System", seed);
}

const SYNONYMS: Array<[string, string, string[]]> = [
  ["Abundant", "Plentiful", ["Scarce", "Rare", "Little"]],
  ["Brief", "Short", ["Long", "Wide", "Heavy"]],
  ["Candid", "Frank", ["Secret", "Rude", "Slow"]],
  ["Diligent", "Hardworking", ["Lazy", "Careless", "Weak"]],
  ["Enormous", "Huge", ["Tiny", "Narrow", "Quiet"]],
  ["Fragile", "Delicate", ["Strong", "Solid", "Rough"]],
  ["Generous", "Liberal", ["Miserly", "Strict", "Silent"]],
  ["Hazard", "Danger", ["Safety", "Comfort", "Help"]],
  ["Impartial", "Unbiased", ["Unfair", "Angry", "Partial"]],
  ["Jubilant", "Joyful", ["Sad", "Angry", "Tired"]],
  ["Lucid", "Clear", ["Dark", "Confusing", "Heavy"]],
  ["Meticulous", "Careful", ["Careless", "Quick", "Rude"]],
  ["Novice", "Beginner", ["Expert", "Leader", "Guide"]],
  ["Obsolete", "Outdated", ["Modern", "Fresh", "Useful"]],
  ["Prudent", "Wise", ["Foolish", "Hasty", "Weak"]],
  ["Reluctant", "Unwilling", ["Eager", "Ready", "Happy"]],
  ["Solemn", "Serious", ["Funny", "Light", "Loud"]],
  ["Transparent", "Clear", ["Opaque", "Thick", "Dark"]],
  ["Vivid", "Bright", ["Dull", "Faint", "Pale"]],
  ["Zealous", "Enthusiastic", ["Indifferent", "Calm", "Lazy"]],
];

const ANTONYMS: Array<[string, string, string[]]> = [
  ["Abundant", "Scarce", ["Plentiful", "Ample", "Rich"]],
  ["Ancient", "Modern", ["Old", "Past", "Historic"]],
  ["Bold", "Timid", ["Brave", "Strong", "Confident"]],
  ["Cautious", "Reckless", ["Careful", "Alert", "Wise"]],
  ["Distant", "Near", ["Far", "Remote", "Apart"]],
  ["Expand", "Contract", ["Grow", "Widen", "Stretch"]],
  ["Fertile", "Barren", ["Rich", "Productive", "Green"]],
  ["Generous", "Miserly", ["Kind", "Liberal", "Helpful"]],
  ["Humble", "Arrogant", ["Modest", "Simple", "Quiet"]],
  ["Increase", "Decrease", ["Rise", "Grow", "Expand"]],
  ["Joy", "Sorrow", ["Happiness", "Delight", "Pleasure"]],
  ["Kind", "Cruel", ["Gentle", "Warm", "Helpful"]],
  ["Loud", "Soft", ["Noisy", "Harsh", "Strong"]],
  ["Optimist", "Pessimist", ["Dreamer", "Realist", "Idealist"]],
  ["Praise", "Criticise", ["Applaud", "Admire", "Respect"]],
  ["Rigid", "Flexible", ["Stiff", "Hard", "Firm"]],
  ["Scatter", "Gather", ["Spread", "Throw", "Divide"]],
  ["Temporary", "Permanent", ["Brief", "Short", "Temporary"]],
  ["Victory", "Defeat", ["Success", "Win", "Triumph"]],
  ["Wise", "Foolish", ["Smart", "Clever", "Bright"]],
];

const SPELLINGS: Array<[string, string[]]> = [
  ["Accommodation", ["Accomodation", "Acommodation", "Accommodetion"]],
  ["Committee", ["Comittee", "Commitee", "Comitee"]],
  ["Definitely", ["Definately", "Definitly", "Defenitely"]],
  ["Embarrass", ["Embarass", "Embarras", "Embarras"]],
  ["Environment", ["Enviroment", "Environmment", "Envirnoment"]],
  ["Government", ["Goverment", "Governmant", "Govermant"]],
  ["Immediately", ["Immediatly", "Immidiately", "Immediatley"]],
  ["Necessary", ["Neccessary", "Necesary", "Necessery"]],
  ["Occurrence", ["Occurence", "Ocurrence", "Occurrance"]],
  ["Privilege", ["Priviledge", "Privilage", "Privelege"]],
  ["Recommend", ["Recomend", "Reccomend", "Recommed"]],
  ["Separate", ["Seperate", "Saperate", "Separete"]],
  ["Successful", ["Succesful", "Successfull", "Sucessful"]],
  ["Tomorrow", ["Tommorow", "Tomorow", "Tommorrow"]],
  ["Vacuum", ["Vacum", "Vaccum", "Vaccuum"]],
];

const IDIOMS: Array<[string, string, string[]]> = [
  ["Break the ice", "Start a conversation", ["End a friendship", "Create a problem", "Break a promise"]],
  ["Hit the nail on the head", "Say exactly the right thing", ["Make a mistake", "Hit someone hard", "Waste time"]],
  ["Once in a blue moon", "Very rarely", ["Very often", "At night", "Suddenly"]],
  ["A piece of cake", "Very easy", ["Very tasty", "Very costly", "Very difficult"]],
  ["Let the cat out of the bag", "Reveal a secret", ["Free an animal", "Start a fight", "Lose a bag"]],
  ["Burn the midnight oil", "Work late at night", ["Waste oil", "Sleep early", "Start a fire"]],
  ["Under the weather", "Feeling unwell", ["Standing outside", "Very happy", "In danger"]],
  ["Bite the bullet", "Face a difficult situation bravely", ["Eat quickly", "Avoid danger", "Make a noise"]],
  ["Spill the beans", "Reveal information", ["Cook food", "Waste food", "Make a mess"]],
  ["At the drop of a hat", "Immediately", ["After a long time", "Without a hat", "By mistake"]],
];

const ONE_WORDS: Array<[string, string, string[]]> = [
  ["A person who studies stars", "Astronomer", ["Astrologer", "Geologist", "Biologist"]],
  ["A place where books are kept", "Library", ["Museum", "Gallery", "Laboratory"]],
  ["A person who writes books", "Author", ["Editor", "Printer", "Publisher"]],
  ["A speech made to oneself", "Soliloquy", ["Monologue", "Dialogue", "Prologue"]],
  ["A government by the people", "Democracy", ["Monarchy", "Oligarchy", "Autocracy"]],
  ["A person who loves mankind", "Philanthropist", ["Misanthrope", "Philosopher", "Patriot"]],
  ["A word with the same meaning", "Synonym", ["Antonym", "Homonym", "Acronym"]],
  ["A word with the opposite meaning", "Antonym", ["Synonym", "Homonym", "Acronym"]],
  ["A person who cannot read or write", "Illiterate", ["Ignorant", "Innocent", "Inactive"]],
  ["A place where money is coined", "Mint", ["Bank", "Treasury", "Vault"]],
];

const GRAMMAR: Array<[string, string, string[]]> = [
  ["She is good ___ mathematics.", "at", ["in", "on", "for"]],
  ["He has been living here ___ 2019.", "since", ["for", "from", "by"]],
  ["The book is ___ the table.", "on", ["in", "at", "by"]],
  ["He is ___ honest man.", "an", ["a", "the", "no article"]],
  ["___ Ganga is a holy river.", "The", ["A", "An", "No article"]],
  ["She prefers tea ___ coffee.", "to", ["than", "over", "from"]],
  ["The train arrived ___ time.", "on", ["in", "at", "by"]],
  ["He is afraid ___ dogs.", "of", ["from", "with", "to"]],
  ["I have known him ___ ten years.", "for", ["since", "from", "by"]],
  ["She is married ___ a doctor.", "to", ["with", "by", "for"]],
];

function englishQuestion(seed: number) {
  const n = Math.abs(seed);
  const template = n % 6;

  if (template === 0) {
    const [word, correct, wrong] = SYNONYMS[n % SYNONYMS.length];
    return pack(`Choose the synonym of "${word}".`, correct, wrong, `"${correct}" has the same meaning as "${word}".`, "Vocabulary", seed);
  }

  if (template === 1) {
    const [word, correct, wrong] = ANTONYMS[n % ANTONYMS.length];
    return pack(`Choose the antonym of "${word}".`, correct, wrong, `"${correct}" is the opposite of "${word}".`, "Vocabulary", seed);
  }

  if (template === 2) {
    const [correct, wrong] = SPELLINGS[n % SPELLINGS.length];
    return pack("Choose the correctly spelt word.", correct, wrong, `The correct spelling is "${correct}".`, "Spelling", seed);
  }

  if (template === 3) {
    const [idiom, correct, wrong] = IDIOMS[n % IDIOMS.length];
    return pack(`What does the idiom "${idiom}" mean?`, correct, wrong, `"${idiom}" means ${correct.toLowerCase()}.`, "Idioms", seed);
  }

  if (template === 4) {
    const [definition, correct, wrong] = ONE_WORDS[n % ONE_WORDS.length];
    return pack(`One word for: ${definition}.`, correct, wrong, `"${correct}" means ${definition.toLowerCase()}.`, "One Word Substitution", seed);
  }

  const [sentence, correct, wrong] = GRAMMAR[n % GRAMMAR.length];
  return pack(`Fill in the blank: ${sentence}`, correct, wrong, `The correct preposition or article is "${correct}".`, "Grammar", seed);
}

const AWARENESS: Array<{ q: string; a: string; wrong: string[]; topic: string; why: string }> = [
  { q: "Which Article of the Constitution provides for the Finance Commission?", a: "Article 280", wrong: ["Article 275", "Article 315", "Article 300A"], topic: "Indian Polity", why: "Article 280 requires the President to constitute a Finance Commission every five years." },
  { q: "Which Article guarantees equality before the law?", a: "Article 14", wrong: ["Article 19", "Article 21", "Article 32"], topic: "Indian Polity", why: "Article 14 guarantees equality before the law and equal protection of the laws." },
  { q: "Which Article is called the heart and soul of the Constitution?", a: "Article 32", wrong: ["Article 14", "Article 21", "Article 44"], topic: "Indian Polity", why: "Dr B. R. Ambedkar called Article 32 the heart and soul of the Constitution." },
  { q: "Who is the constitutional head of the Indian Union?", a: "President", wrong: ["Prime Minister", "Chief Justice", "Speaker"], topic: "Indian Polity", why: "The President is the constitutional head of the Union." },
  { q: "How many fundamental rights are guaranteed by the Indian Constitution?", a: "Six", wrong: ["Five", "Seven", "Eight"], topic: "Indian Polity", why: "There are six fundamental rights after the right to property was removed as a fundamental right." },
  { q: "Which schedule of the Constitution deals with languages?", a: "Eighth Schedule", wrong: ["Seventh Schedule", "Ninth Schedule", "Tenth Schedule"], topic: "Indian Polity", why: "The Eighth Schedule lists the recognised languages of India." },
  { q: "Which body conducts elections to Parliament and State Legislatures?", a: "Election Commission of India", wrong: ["UPSC", "Finance Commission", "NITI Aayog"], topic: "Indian Polity", why: "The Election Commission of India conducts elections to Parliament and State Legislatures." },
  { q: "Which is the largest ocean on Earth?", a: "Pacific Ocean", wrong: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], topic: "Geography", why: "The Pacific Ocean is the largest and deepest ocean." },
  { q: "Which is the longest river in India?", a: "Ganga", wrong: ["Godavari", "Yamuna", "Brahmaputra"], topic: "Geography", why: "The Ganga is the longest river flowing within India." },
  { q: "Which is the highest mountain peak in India?", a: "Kangchenjunga", wrong: ["Nanda Devi", "K2", "Everest"], topic: "Geography", why: "Kangchenjunga is the highest mountain peak located in India." },
  { q: "Which state has the longest coastline in India?", a: "Gujarat", wrong: ["Tamil Nadu", "Andhra Pradesh", "Maharashtra"], topic: "Geography", why: "Gujarat has the longest coastline among Indian states." },
  { q: "Which is the largest state of India by area?", a: "Rajasthan", wrong: ["Madhya Pradesh", "Maharashtra", "Uttar Pradesh"], topic: "Geography", why: "Rajasthan is the largest Indian state by area." },
  { q: "Which line divides India into almost two equal parts?", a: "Tropic of Cancer", wrong: ["Equator", "Tropic of Capricorn", "Prime Meridian"], topic: "Geography", why: "The Tropic of Cancer passes through the middle of India." },
  { q: "Which is the largest freshwater lake in India?", a: "Wular Lake", wrong: ["Chilika Lake", "Dal Lake", "Loktak Lake"], topic: "Geography", why: "Wular Lake in Jammu and Kashmir is the largest freshwater lake in India." },
  { q: "Which is the largest desert in India?", a: "Thar Desert", wrong: ["Rann of Kutch", "Ladakh Desert", "Deccan Plateau"], topic: "Geography", why: "The Thar Desert is the largest desert in India." },
  { q: "Who was the first Governor-General of independent India?", a: "Lord Mountbatten", wrong: ["C. Rajagopalachari", "Lord Canning", "Warren Hastings"], topic: "Modern History", why: "Lord Mountbatten was the first Governor-General of independent India." },
  { q: "Who founded the Indian National Congress in 1885?", a: "A. O. Hume", wrong: ["Dadabhai Naoroji", "Bal Gangadhar Tilak", "Gopal Krishna Gokhale"], topic: "Modern History", why: "A. O. Hume founded the Indian National Congress in 1885." },
  { q: "In which year did India gain independence?", a: "1947", wrong: ["1942", "1950", "1935"], topic: "Modern History", why: "India gained independence on 15 August 1947." },
  { q: "Who gave the slogan 'Give me blood and I will give you freedom'?", a: "Subhas Chandra Bose", wrong: ["Mahatma Gandhi", "Bhagat Singh", "Jawaharlal Nehru"], topic: "Modern History", why: "Subhas Chandra Bose gave this slogan." },
  { q: "Who was the first Prime Minister of India?", a: "Jawaharlal Nehru", wrong: ["Sardar Patel", "Rajendra Prasad", "Lal Bahadur Shastri"], topic: "Modern History", why: "Jawaharlal Nehru was the first Prime Minister of India." },
  { q: "The Quit India Movement was launched in which year?", a: "1942", wrong: ["1930", "1935", "1946"], topic: "Modern History", why: "The Quit India Movement was launched in 1942." },
  { q: "Who is known as the Iron Man of India?", a: "Sardar Vallabhbhai Patel", wrong: ["Jawaharlal Nehru", "Subhas Chandra Bose", "Lal Bahadur Shastri"], topic: "Modern History", why: "Sardar Vallabhbhai Patel is known as the Iron Man of India." },
  { q: "Which is the smallest bone in the human body?", a: "Stapes", wrong: ["Femur", "Tibia", "Radius"], topic: "General Science", why: "The stapes, in the middle ear, is the smallest bone in the human body." },
  { q: "Which gas is most abundant in the Earth's atmosphere?", a: "Nitrogen", wrong: ["Oxygen", "Carbon dioxide", "Argon"], topic: "General Science", why: "Nitrogen makes up about 78% of the Earth's atmosphere." },
  { q: "What is the chemical symbol for gold?", a: "Au", wrong: ["Ag", "Gd", "Go"], topic: "General Science", why: "The chemical symbol for gold is Au." },
  { q: "Which vitamin is produced when the skin is exposed to sunlight?", a: "Vitamin D", wrong: ["Vitamin A", "Vitamin B12", "Vitamin C"], topic: "General Science", why: "Sunlight helps the skin synthesise Vitamin D." },
  { q: "Which part of the plant carries out photosynthesis?", a: "Leaf", wrong: ["Root", "Stem", "Flower"], topic: "General Science", why: "Leaves contain chlorophyll and carry out photosynthesis." },
  { q: "What is the SI unit of force?", a: "Newton", wrong: ["Joule", "Watt", "Pascal"], topic: "General Science", why: "Force is measured in newtons." },
  { q: "Which planet is known as the Red Planet?", a: "Mars", wrong: ["Venus", "Jupiter", "Mercury"], topic: "General Science", why: "Mars appears red because of iron oxide on its surface." },
  { q: "Which is the hardest natural substance?", a: "Diamond", wrong: ["Iron", "Quartz", "Granite"], topic: "General Science", why: "Diamond is the hardest known natural substance." },
  { q: "Which blood group is called the universal donor?", a: "O negative", wrong: ["AB positive", "A positive", "B negative"], topic: "General Science", why: "O negative blood can be given to patients of any blood group." },
  { q: "What is the pH of pure water?", a: "7", wrong: ["5", "9", "1"], topic: "General Science", why: "Pure water is neutral and has a pH of 7." },
  { q: "Which is the largest gland in the human body?", a: "Liver", wrong: ["Pancreas", "Thyroid", "Salivary gland"], topic: "General Science", why: "The liver is the largest gland in the human body." },
  { q: "Which is the currency of Japan?", a: "Yen", wrong: ["Won", "Yuan", "Ringgit"], topic: "Static GK", why: "The currency of Japan is the yen." },
  { q: "Which is the national bird of India?", a: "Peacock", wrong: ["Parrot", "Eagle", "Sparrow"], topic: "Static GK", why: "The Indian peacock is the national bird of India." },
  { q: "Which is the national animal of India?", a: "Tiger", wrong: ["Lion", "Elephant", "Leopard"], topic: "Static GK", why: "The Bengal tiger is the national animal of India." },
  { q: "Which is the national flower of India?", a: "Lotus", wrong: ["Rose", "Sunflower", "Marigold"], topic: "Static GK", why: "The lotus is the national flower of India." },
  { q: "Where is the headquarters of the Reserve Bank of India?", a: "Mumbai", wrong: ["New Delhi", "Kolkata", "Chennai"], topic: "Banking Awareness", why: "The RBI's central office is in Mumbai." },
  { q: "What does NPA stand for in banking?", a: "Non-Performing Asset", wrong: ["National Payment Authority", "Net Profit Account", "New Priority Asset"], topic: "Banking Awareness", why: "A loan becomes a non-performing asset when repayment is overdue." },
  { q: "Which institution regulates monetary policy in India?", a: "RBI", wrong: ["SEBI", "IRDAI", "NABARD"], topic: "Banking Awareness", why: "The Reserve Bank of India manages monetary policy." },
  { q: "What is the full form of IFSC?", a: "Indian Financial System Code", wrong: ["International Fund Service Code", "Indian Fund Security Code", "Interbank Financial Settlement Code"], topic: "Banking Awareness", why: "IFSC is the Indian Financial System Code used for bank transfers." },
  { q: "Which is the apex bank for agriculture and rural development in India?", a: "NABARD", wrong: ["SIDBI", "RBI", "EXIM Bank"], topic: "Banking Awareness", why: "NABARD is the apex development bank for agriculture and rural development." },
  { q: "Which is the largest public sector bank in India?", a: "State Bank of India", wrong: ["Punjab National Bank", "Bank of Baroda", "Canara Bank"], topic: "Banking Awareness", why: "State Bank of India is the largest public sector bank in India." },
  { q: "What is the full form of GDP?", a: "Gross Domestic Product", wrong: ["Gross Development Product", "General Domestic Price", "Gross Demand Product"], topic: "Indian Economy", why: "GDP measures the value of goods and services produced within a country." },
  { q: "Which sector contributes the largest share to India's GDP?", a: "Services", wrong: ["Agriculture", "Manufacturing", "Mining"], topic: "Indian Economy", why: "The services sector contributes the largest share to India's GDP." },
  { q: "Who presents the Union Budget in India?", a: "Finance Minister", wrong: ["Prime Minister", "President", "RBI Governor"], topic: "Indian Economy", why: "The Union Finance Minister presents the Union Budget." },
  { q: "What is the full form of GST?", a: "Goods and Services Tax", wrong: ["General Sales Tax", "Gross Service Tax", "Government Service Tax"], topic: "Indian Economy", why: "GST is a unified indirect tax on goods and services." },
  { q: "Which is the primary source of energy for the Earth?", a: "Sun", wrong: ["Moon", "Wind", "Coal"], topic: "Environment", why: "The Sun is the primary source of energy for the Earth." },
  { q: "Which gas is mainly responsible for the greenhouse effect?", a: "Carbon dioxide", wrong: ["Oxygen", "Nitrogen", "Helium"], topic: "Environment", why: "Carbon dioxide is a major greenhouse gas." },
  { q: "Which day is celebrated as World Environment Day?", a: "5 June", wrong: ["22 April", "1 May", "8 March"], topic: "Environment", why: "World Environment Day is observed on 5 June." },
  { q: "Which is the largest mammal on Earth?", a: "Blue whale", wrong: ["Elephant", "Giraffe", "Hippopotamus"], topic: "Environment", why: "The blue whale is the largest mammal on Earth." },
  { q: "Which is the national aquatic animal of India?", a: "Ganges river dolphin", wrong: ["Blue whale", "Crocodile", "Turtle"], topic: "Environment", why: "The Ganges river dolphin is the national aquatic animal of India." },
  { q: "Which is the capital of Australia?", a: "Canberra", wrong: ["Sydney", "Melbourne", "Perth"], topic: "Static GK", why: "Canberra is the capital of Australia." },
  { q: "Which is the capital of Canada?", a: "Ottawa", wrong: ["Toronto", "Vancouver", "Montreal"], topic: "Static GK", why: "Ottawa is the capital of Canada." },
  { q: "Which country is known as the Land of the Rising Sun?", a: "Japan", wrong: ["China", "Thailand", "South Korea"], topic: "Static GK", why: "Japan is known as the Land of the Rising Sun." },
  { q: "Which is the largest continent?", a: "Asia", wrong: ["Africa", "Europe", "North America"], topic: "Geography", why: "Asia is the largest continent by area and population." },
  { q: "Which is the smallest continent?", a: "Australia", wrong: ["Europe", "Antarctica", "South America"], topic: "Geography", why: "Australia is the smallest continent." },
  { q: "Which is the deepest ocean trench?", a: "Mariana Trench", wrong: ["Java Trench", "Puerto Rico Trench", "Tonga Trench"], topic: "Geography", why: "The Mariana Trench contains the deepest known point in the ocean." },
  { q: "Which is the longest river in the world?", a: "Nile", wrong: ["Amazon", "Yangtze", "Mississippi"], topic: "Geography", why: "The Nile is generally regarded as the longest river in the world." },
  { q: "Which is the largest island in the world?", a: "Greenland", wrong: ["New Guinea", "Borneo", "Madagascar"], topic: "Geography", why: "Greenland is the largest island in the world." },
  { q: "Which is the headquarters of the United Nations?", a: "New York", wrong: ["Geneva", "Paris", "London"], topic: "Static GK", why: "The United Nations headquarters is in New York." },
  { q: "Which is the headquarters of the World Health Organization?", a: "Geneva", wrong: ["New York", "Paris", "Rome"], topic: "Static GK", why: "The WHO headquarters is in Geneva." },
  { q: "Who wrote the national anthem of India?", a: "Rabindranath Tagore", wrong: ["Bankim Chandra Chatterjee", "Sarojini Naidu", "Muhammad Iqbal"], topic: "Static GK", why: "Rabindranath Tagore wrote Jana Gana Mana." },
  { q: "Who wrote 'Discovery of India'?", a: "Jawaharlal Nehru", wrong: ["Mahatma Gandhi", "S. Radhakrishnan", "B. R. Ambedkar"], topic: "Static GK", why: "Jawaharlal Nehru wrote The Discovery of India." },
  { q: "Which is the first month of the Indian national calendar?", a: "Chaitra", wrong: ["Vaishakha", "Kartika", "Pausha"], topic: "Static GK", why: "Chaitra is the first month of the Saka calendar." },
  { q: "Which is the national sport of India?", a: "Hockey", wrong: ["Cricket", "Football", "Kabaddi"], topic: "Static GK", why: "Hockey is traditionally regarded as India's national sport." },
  { q: "Which is the largest planet in the solar system?", a: "Jupiter", wrong: ["Saturn", "Neptune", "Earth"], topic: "General Science", why: "Jupiter is the largest planet in the solar system." },
  { q: "Which planet is closest to the Sun?", a: "Mercury", wrong: ["Venus", "Earth", "Mars"], topic: "General Science", why: "Mercury is the closest planet to the Sun." },
  { q: "What is the speed of light in vacuum?", a: "3 x 10^8 m/s", wrong: ["3 x 10^6 m/s", "3 x 10^5 m/s", "3 x 10^10 m/s"], topic: "General Science", why: "Light travels at about 3 x 10^8 metres per second in vacuum." },
  { q: "Which instrument is used to measure atmospheric pressure?", a: "Barometer", wrong: ["Thermometer", "Hygrometer", "Anemometer"], topic: "General Science", why: "A barometer measures atmospheric pressure." },
  { q: "Which is the unit of electric current?", a: "Ampere", wrong: ["Volt", "Ohm", "Watt"], topic: "General Science", why: "Electric current is measured in amperes." },
  { q: "Which acid is present in lemon?", a: "Citric acid", wrong: ["Acetic acid", "Lactic acid", "Sulphuric acid"], topic: "General Science", why: "Lemon contains citric acid." },
  { q: "Which is the largest cell in the human body?", a: "Ovum", wrong: ["Nerve cell", "Muscle cell", "Red blood cell"], topic: "General Science", why: "The ovum is the largest cell in the human body." },
  { q: "Which organ purifies blood in the human body?", a: "Kidney", wrong: ["Heart", "Liver", "Lungs"], topic: "General Science", why: "The kidneys filter waste products from the blood." },
  { q: "Which vitamin deficiency causes scurvy?", a: "Vitamin C", wrong: ["Vitamin A", "Vitamin D", "Vitamin K"], topic: "General Science", why: "Scurvy is caused by a deficiency of Vitamin C." },
  { q: "Which is the first element in the periodic table?", a: "Hydrogen", wrong: ["Helium", "Oxygen", "Carbon"], topic: "General Science", why: "Hydrogen has atomic number 1." },
];

const TEACHING: Array<{ q: string; a: string; wrong: string[]; topic: string; why: string }> = [
  { q: "According to Piaget, which stage is characterised by conservation and logical thinking?", a: "Concrete operational", wrong: ["Sensorimotor", "Pre-operational", "Formal operational"], topic: "Child Development", why: "Conservation develops in the concrete operational stage." },
  { q: "Which theorist is associated with the zone of proximal development?", a: "Vygotsky", wrong: ["Piaget", "Kohlberg", "Skinner"], topic: "Child Development", why: "Vygotsky introduced the zone of proximal development." },
  { q: "Which type of motivation comes from within the learner?", a: "Intrinsic motivation", wrong: ["Extrinsic motivation", "Negative motivation", "Reward motivation"], topic: "Learning", why: "Intrinsic motivation arises from personal interest or satisfaction." },
  { q: "Which is the best example of formative assessment?", a: "A short quiz during a lesson", wrong: ["A final term exam", "A board examination", "An annual result"], topic: "Assessment", why: "Formative assessment is used during learning to guide instruction." },
  { q: "Which is a characteristic of inclusive education?", a: "All learners learn together in the same classroom", wrong: ["Only gifted students are included", "Students with disabilities are separated", "Only language learners are included"], topic: "Inclusive Education", why: "Inclusive education welcomes all learners in a common classroom." },
  { q: "Which is the correct order of Bloom's revised taxonomy?", a: "Remember, understand, apply, analyse, evaluate, create", wrong: ["Remember, apply, understand, create, evaluate, analyse", "Understand, remember, apply, evaluate, analyse, create", "Apply, remember, understand, analyse, create, evaluate"], topic: "Pedagogy", why: "The revised taxonomy moves from remembering to creating." },
  { q: "Which teaching method is most learner-centred?", a: "Project-based learning", wrong: ["Lecture method", "Demonstration only", "Rote memorisation"], topic: "Pedagogy", why: "Project-based learning gives learners active responsibility." },
  { q: "What does the term 'scaffolding' mean in teaching?", a: "Providing temporary support that is gradually removed", wrong: ["Punishing weak learners", "Teaching without support", "Testing without feedback"], topic: "Learning", why: "Scaffolding is temporary support that fades as competence grows." },
  { q: "Which factor most directly affects a child's attention span?", a: "Age and interest", wrong: ["Height", "Shoe size", "Blood group"], topic: "Child Development", why: "Attention span develops with age and is influenced by interest." },
  { q: "Which is an example of a gross motor skill?", a: "Running", wrong: ["Writing", "Drawing", "Buttoning a shirt"], topic: "Child Development", why: "Gross motor skills involve large muscle groups such as running." },
  { q: "Which is an example of a fine motor skill?", a: "Writing with a pencil", wrong: ["Jumping", "Running", "Climbing"], topic: "Child Development", why: "Fine motor skills involve small, precise movements." },
  { q: "Which is the most appropriate way to handle a child's error?", a: "Provide corrective feedback and encourage another attempt", wrong: ["Shame the child publicly", "Ignore all errors", "Stop the lesson"], topic: "Assessment", why: "Constructive feedback helps the child learn without fear." },
  { q: "Which is a formative use of assessment data?", a: "Adjusting the next lesson", wrong: ["Ranking students only", "Punishing low scorers", "Ignoring the results"], topic: "Assessment", why: "Formative data should inform teaching decisions." },
  { q: "Which is a sign of a conducive classroom environment?", a: "Respectful interaction and clear routines", wrong: ["Frequent shouting", "No rules", "Only teacher talk"], topic: "Pedagogy", why: "Respect and predictable routines support learning." },
  { q: "Which is the best way to teach a new concept?", a: "Connect it to learners' prior knowledge", wrong: ["Start with an unrelated topic", "Avoid examples", "Only read the definition"], topic: "Pedagogy", why: "Prior knowledge helps learners attach new ideas to existing schemas." },
  { q: "Which is an example of experiential learning?", a: "Learning by doing a science experiment", wrong: ["Memorising a definition", "Listening to a lecture only", "Copying from the board"], topic: "Learning", why: "Experiential learning involves direct experience and reflection." },
  { q: "Which is a characteristic of a gifted learner?", a: "Advanced reasoning and rapid learning", wrong: ["Always low motivation", "Inability to generalise", "No curiosity"], topic: "Inclusive Education", why: "Gifted learners often show advanced reasoning and fast learning." },
  { q: "Which is the purpose of a diagnostic test?", a: "To identify specific learning difficulties", wrong: ["To rank the class", "To award certificates", "To replace teaching"], topic: "Assessment", why: "Diagnostic tests identify strengths and gaps." },
  { q: "Which is the best example of collaborative learning?", a: "A group solving a problem together", wrong: ["A student copying notes", "A teacher reading aloud", "A silent individual test"], topic: "Learning", why: "Collaborative learning involves joint problem solving." },
  { q: "Which is a child-centred classroom practice?", a: "Giving learners choices in activities", wrong: ["Only lecturing", "Ignoring learner questions", "Using one fixed method"], topic: "Pedagogy", why: "Child-centred practice responds to learners' needs and choices." },
];

function awarenessQuestion(seed: number) {
  const n = Math.abs(seed);
  const fact = AWARENESS[n % AWARENESS.length];
  return pack(fact.q, fact.a, fact.wrong, fact.why, fact.topic, seed);
}

function teachingQuestion(seed: number) {
  const n = Math.abs(seed);
  const fact = TEACHING[n % TEACHING.length];
  return pack(fact.q, fact.a, fact.wrong, fact.why, fact.topic, seed);
}

function questionForSection(sectionName: string, seed: number) {
  const lower = sectionName.toLowerCase();

  if (lower.includes("child") || lower.includes("pedagogy")) {
    return teachingQuestion(seed);
  }
  if (lower.includes("mixed")) {
    const pick = Math.abs(seed) % 4;
    if (pick === 0) return quantQuestion(seed);
    if (pick === 1) return reasoningQuestion(seed);
    if (pick === 2) return englishQuestion(seed);
    return awarenessQuestion(seed);
  }
  if (lower.includes("english") || lower.includes("language")) {
    return englishQuestion(seed);
  }
  if (lower.includes("csat")) {
    return seed % 2 === 0 ? quantQuestion(seed) : reasoningQuestion(seed);
  }
  if (lower.includes("reason") || lower.includes("intelligence")) {
    return reasoningQuestion(seed);
  }
  if (
    lower.includes("math") ||
    lower.includes("quant") ||
    lower.includes("arithmetic") ||
    lower.includes("numerical")
  ) {
    return quantQuestion(seed);
  }
  return awarenessQuestion(seed);
}

export function buildPracticeQuestions(
  sectionName: string,
  count: number,
  marks: number,
  negativeMarks: number,
  startNumber: number,
  seed: number,
): GeneratedQuestion[] {
  return Array.from({ length: count }, (_, index) => {
    const generated = questionForSection(sectionName, seed * 131 + index * 17 + sectionName.length);
    return {
      questionNumber: startNumber + index,
      text: generated.text,
      options: generated.options,
      correctOptionId: generated.correctOptionId,
      explanation: generated.explanation,
      subjectTag: sectionName,
      topicTag: generated.topicTag,
      marks,
      negativeMarks,
      sourceConfidence: 1,
    };
  });
}
