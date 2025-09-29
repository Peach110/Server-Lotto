const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const os = require("os");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: "10mb" }));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ✅ ใช้ connection pool
const db = mysql
  .createPool({
    connectionLimit: 10,
    host: "202.28.34.203",
    port: "3306",
    user: "mb68_66011212222",
    password: "@Hq27hP@LnQo",
    database: "mb68_66011212222",
  })
  .promise();

// ✅ ทดสอบ connection
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ Connected to MySQL database 'mb68_66011212222'.");
    conn.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

// GET ทุกคน
app.get("/person", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT Person_id, Name, Email, Wallet_balance, Typeuser FROM Person"
    );
    res.json({
      success: true,
      persons: rows,
    });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

// GET ตาม Person_id
app.get("/person/:id", async (req, res) => {
  const personId = req.params.id;
  try {
    const [rows] = await db.query(
      "SELECT Person_id, Name, Email, Wallet_balance, Typeuser FROM Person WHERE Person_id = ?",
      [personId]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบข้อมูลผู้ใช้งาน" });
    }
    res.json({ success: true, person: rows[0] });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

//login
app.post("/person/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "กรุณากรอก Email และ Password" });
  }

  try {
    const [results] = await db.query("SELECT * FROM Person WHERE Email = ?", [
      email,
    ]);
    if (results.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    const user = results[0];

    const match = await bcrypt.compare(password, user.Password);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    delete user.Password;
    res.json({ success: true, person: user });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

//SingUp
app.post("/SignUp", async (req, res) => {
  const { name, Email, Password, wallet_balance, typeuser } = req.body;

  const Name = name || "";
  const Wallet_balance = wallet_balance !== undefined ? wallet_balance : 0.0;
  const Typeuser = typeuser !== undefined ? typeuser : "user";

  try {
    const hashedPassword = await bcrypt.hash(Password, 10); // saltRounds = 10

    const [result] = await db.query(
      "INSERT INTO Person (Name, Email, Password, Wallet_balance, Typeuser) VALUES (?, ?, ?, ?, ?)",
      [Name, Email, hashedPassword, Wallet_balance, Typeuser]
    );

    res.status(201).json({
      success: true,
      message: "เพิ่มข้อมูลเรียบร้อย",
      person: {
        id: result.insertId,
        Name,
        Email,
        Wallet_balance,
        Typeuser,
      },
    });
  } catch (err) {
    console.error(err.message);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "อีเมลนี้มีอยู่ในระบบแล้ว" });
    }
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

// Member Register
app.post("/member_register", async (req, res) => {
  const { Email, Password, Wallet_balance } = req.body;

  try {

    const [rows] = await db.query("SELECT * FROM Person WHERE Email = ?", [
      Email,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบบัญชีนี้" });
    }

    const user = rows[0];

    // ตรวจสอบ password ว่าตรงหรือไม่ (ใช้ bcrypt.compare)
    const isMatch = await bcrypt.compare(Password, user.Password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    }

    if (user.Typeuser === 0) {
      await db.query(
        "UPDATE Person SET Typeuser = 1, Wallet_balance = ? WHERE Email = ?",
        [Wallet_balance, Email]
      );

      return res.status(200).json({
        success: true,
        message: "อัปเกรดสถานะสมาชิกเรียบร้อย",
        person: {
          id: user.ID,
          Email: user.Email,
          Wallet_balance,
          Typeuser: 1,
        },
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "บัญชีนี้สมัครสมาชิกแล้ว" });
    }
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

app.get("/get_wallet/:Person_id", async (req, res) => {
  const { Person_id } = req.params;

  try {
    const [rows] = await db.execute(
      "SELECT Wallet_balance FROM Person WHERE Person_id = ?",
      [Person_id]
    );

    if (rows.length > 0) {
      res.json({
        success: true,
        wallet_balance: rows[0].Wallet_balance,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลสมาชิก",
      });
    }
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดที่ server",
    });
  }
});

//update_wallet
app.post("/add-wallet", async (req, res) => {
  let { Person_id, Amount } = req.body;

  Amount = parseFloat(Amount ?? req.body.amount);
  Person_id = parseInt(Person_id, 10);
  // Amount = parseInt(Amount, 10);
  // let Lotto_id = parseInt(Lotto_id, 10);

  if (!Person_id || isNaN(Amount)) {
    return res.status(400).json({ success: false, message: "Person_id และ Amount ต้องระบุเป็นตัวเลข" });
  }

  try {
    // เพิ่มเงิน
    const [result] = await db.execute(
      "UPDATE Person SET Wallet_balance = Wallet_balance + ? WHERE Person_id = ?",
      [Amount, Person_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้งาน" });
    }

    // // อัปเดต Lotto ว่าขึ้นเงินแล้ว
    // if (Lotto_id) {
    //   await db.execute(
    //     "UPDATE Lotto SET IsClaimed = 1, Status = 'Sold' WHERE Lotto_id = ?",
    //     [Lotto_id]
    //   );
    // }

    // ดึงยอดเงินปัจจุบัน
    const [rows] = await db.execute(
      "SELECT Wallet_balance FROM Person WHERE Person_id = ?",
      [Person_id]
    );

    res.json({ success: true, Wallet_balance: rows[0].Wallet_balance });

  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
});


// ฟังก์ชันสำหรับสร้างเลขหวย 6 หลัก
const generateRandomNumber = (length) => {
  let result = "";
  const characters = "0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// ฟังก์ชันสำหรับสร้างและบันทึกเลขหวย
app.post("/generate", async (req, res) => {
  const { count } = req.body;
  if (!count || count <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "กรุณาระบุจำนวนหวยที่ต้องการสร้าง" });
  }
  try {
    const generatedNumbers = [];
    const lotteriesToInsert = [];
    for (let i = 0; i < count; i++) {
      const newNumber = generateRandomNumber(6);
      generatedNumbers.push(newNumber);
      lotteriesToInsert.push([newNumber, "Available", 80]);
    }
    await db.query(
      "INSERT IGNORE INTO Lotto (Number, Status, Price) VALUES ?",
      [lotteriesToInsert]
    );
    res.status(201).json({
      success: true,
      message: `สร้างหวย ${generatedNumbers.length} หมายเลขเรียบร้อย`,
      lotteryNumbers: generatedNumbers,
    });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดในการสร้างหวย" });
  }
});

app.post("/check-admin", async (req, res) => {
  try {
    const { personId } = req.body; 
    if (!personId) {
      return res
        .status(400)
        .json({ success: false, message: "Person ID ไม่ถูกต้อง" });
    }

    const [rows] = await db.query(
      "SELECT Typeuser FROM Person WHERE Person_id = ?",
      [personId]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบผู้ใช้งาน" });
    }

    const typeuser = rows[0].Typeuser; // 2 = admin
    if (typeuser !== 2) {
      return res
        .status(403)
        .json({ success: false, message: "คุณไม่มีสิทธิ์เข้าหน้านี้" });
    }

    res.json({ success: true, message: "เป็น admin", typeuser });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
  }
});

// GET รางวัลล่าสุด
app.get("/prizes/latest", async (req, res) => {
  try {

    const [latestResult] = await db.query(
      "SELECT Result_id FROM Winning_results ORDER BY Draw_date DESC, Result_id DESC LIMIT 1"
    );

    if (latestResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ยังไม่มีการออกรางวัล",
      });
    }

    const resultId = latestResult[0].Result_id;

    const [winningPrizes] = await db.query(
      "SELECT p.Prize_type, wp.Winning_number " +
        "FROM Winning_Prizes wp " +
        "JOIN Prize p ON wp.Prize_id = p.Prize_id " +
        "WHERE wp.Result_id = ?",
      [resultId]
    );

    const prizes = {};
    winningPrizes.forEach((row) => {
      switch (row.Prize_type) {
        case "1st":
          prizes["prize1"] = row.Winning_number;
          break;
        case "2nd":
          prizes["prize2"] = row.Winning_number;
          break;
        case "3rd":
          prizes["prize3"] = row.Winning_number;
          break;
        case "Last3":
          prizes["last3Digits"] = row.Winning_number;
          break;
        case "Last2":
          prizes["last2Digits"] = row.Winning_number;
          break;
      }
    });

    res.json({
      success: true,
      resultId,
      prizes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรางวัลล่าสุด",
    });
  }
});

// สุ่มรางวัลจากหวยที่ถูกขาย
app.post("/draw-prizes", async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT a.Admin_id 
       FROM Admin a 
       JOIN Person p ON a.Person_id = p.Person_id 
       WHERE p.Typeuser = 2
       LIMIT 1`
    );

    if (admins.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ไม่พบ Admin ที่ใช้งานได้" });
    }

    const adminId = admins[0].Admin_id;

    const [lotteries] = await db.query("SELECT Number FROM Lotto");
    const availableNumbers = lotteries.map((lotto) => lotto.Number);

    if (availableNumbers.length < 5) {
      return res.status(400).json({
        success: false,
        message: "จำนวนหวยไม่เพียงพอสำหรับการออกรางวัล",
      });
    }

    const shuffleArray = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    const shuffledNumbers = shuffleArray(availableNumbers);
    const prize1 = shuffledNumbers[0];
    const prize2 = shuffledNumbers[1];
    const prize3 = shuffledNumbers[2];
    const last3Digits = prize1.slice(-3);
    const last2Digits = prize1.slice(-2);

    // 💡 บันทึกผลรางวัลลงฐานข้อมูล
    const [result] = await db.query(
      "INSERT INTO Winning_results (Draw_date, Admin_id) VALUES (CURDATE(), ?)",
      [adminId]
    );
    const resultId = result.insertId;

    await db.query(
      "INSERT INTO Winning_Prizes (Result_id, Winning_number, Prize_id) VALUES (?, ?, ?)",
      [resultId, prize1, 1]
    );
    await db.query(
      "INSERT INTO Winning_Prizes (Result_id, Winning_number, Prize_id) VALUES (?, ?, ?)",
      [resultId, prize2, 2]
    );
    await db.query(
      "INSERT INTO Winning_Prizes (Result_id, Winning_number, Prize_id) VALUES (?, ?, ?)",
      [resultId, prize3, 3]
    );
    await db.query(
      "INSERT INTO Winning_Prizes (Result_id, Winning_number, Prize_id) VALUES (?, ?, ?)",
      [resultId, last3Digits, 4]
    );
    await db.query(
      "INSERT INTO Winning_Prizes (Result_id, Winning_number, Prize_id) VALUES (?, ?, ?)",
      [resultId, last2Digits, 5]
    );

    res.status(201).json({
      success: true,
      message: "ออกรางวัลเรียบร้อย",
      adminId,
      prizes: {
        prize1,
        prize2,
        prize3,
        last3Digits,
        last2Digits,
      },
    });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดในการออกรางวัล" });
  }
});

app.post("/check-lotto/:Person_id/:Lotto_id", async (req, res) => {
  let Person_id = parseInt(req.params.Person_id, 10);
  let Lotto_id = parseInt(req.params.Lotto_id, 10);

  if (isNaN(Person_id) || isNaN(Lotto_id)) {
    return res.status(400).json({ success: false, message: "Person_id หรือ Lotto_id ไม่ถูกต้อง" });
  }

  try {
    // ดึง Result ล่าสุด
    const [latestResult] = await db.query(
      "SELECT Result_id FROM Winning_results ORDER BY Draw_date DESC, Result_id DESC LIMIT 1"
    );

    if (latestResult.length === 0) {
      return res.status(404).json({ success: false, message: "ยังไม่มีการออกรางวัล" });
    }

    const resultId = latestResult[0].Result_id;

    const [winningPrizes] = await db.query(
      `SELECT p.Prize_type, wp.Winning_number, p.Reward_amount
       FROM Winning_Prizes wp
       JOIN Prize p ON wp.Prize_id = p.Prize_id
       WHERE wp.Result_id = ?`,
      [resultId]
    );

    const prizes = {};
    winningPrizes.forEach((row) => {
      prizes[row.Prize_type] = {
        number: row.Winning_number,
        amount: Number(row.Reward_amount),
      };
    });

    // ดึงล็อตเตอรี่ของผู้เล่น
    const [lottos] = await db.query(
      "SELECT Lotto_id, Number, IsClaimed FROM Lotto WHERE Person_id = ? AND Lotto_id = ?",
      [Person_id, Lotto_id]
    );

    if (lottos.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบล็อตเตอรี่นี้" });
    }

    const lotto = lottos[0];

    // ถ้าเคยขึ้นเงินแล้ว
    if (lotto.IsClaimed) {
      return res.json({
        success: false,
        message: "ล็อตเตอรี่นี้เคยขึ้นเงินแล้ว",
        Win: [],
        prizeAmount: 0,
      });
    }

    const lottoNumber = lotto.Number;
    const winTypes = [];
    let prizeAmount = 0;

    if (lottoNumber === prizes["1st"]?.number) {
      winTypes.push("รางวัลที่ 1");
      prizeAmount += prizes["1st"].amount;
    }
    if (lottoNumber === prizes["2nd"]?.number) {
      winTypes.push("รางวัลที่ 2");
      prizeAmount += prizes["2nd"].amount;
    }
    if (lottoNumber === prizes["3rd"]?.number) {
      winTypes.push("รางวัลที่ 3");
      prizeAmount += prizes["3rd"].amount;
    }
    if (lottoNumber.slice(-3) === prizes["Last3"]?.number) {
      winTypes.push("เลขท้าย 3 ตัว");
      prizeAmount += prizes["Last3"].amount;
    }
    if (lottoNumber.slice(-2) === prizes["Last2"]?.number) {
      winTypes.push("เลขท้าย 2 ตัว");
      prizeAmount += prizes["Last2"].amount;
    }

    // แปลง prizeAmount เป็น number
    prizeAmount = Number(prizeAmount);

    // ถ้ามีรางวัลจึงอัปเดต wallet
    if (prizeAmount > 0) {
      await db.query(
        "UPDATE Person SET Wallet_balance = Wallet_balance + ? WHERE Person_id = ?",
        [prizeAmount, Person_id]
      );

      await db.query(
        "UPDATE Lotto SET Status = 'Sold', IsClaimed = 1 WHERE Lotto_id = ?",
        [Lotto_id]
      );
    }

    res.json({
      success: true,
      Win: winTypes,
      prizeAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดตรวจรางวัล" });
  }
});

// GET ตรวจล็อตเตอรี่ของผู้เล่น
app.get("/check-lotto/:Person_id", async (req, res) => {
  const { Person_id } = req.params;

  try {
    // 1. หา Result_id ล่าสุด
    const [latestResult] = await db.query(
      "SELECT Result_id FROM Winning_results ORDER BY Draw_date DESC, Result_id DESC LIMIT 1"
    );

    if (latestResult.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "ยังไม่มีการออกรางวัล" });
    }

    const resultId = latestResult[0].Result_id;

    // 2. ดึงเลขรางวัลล่าสุด
    const [winningPrizes] = await db.query(
      "SELECT p.Prize_type, wp.Winning_number FROM Winning_Prizes wp JOIN Prize p ON wp.Prize_id = p.Prize_id WHERE wp.Result_id = ?",
      [resultId]
    );

    const prizes = {};
    winningPrizes.forEach((row) => {
      prizes[row.Prize_type] = row.Winning_number;
    });

    // 3. ดึงล็อตเตอรี่ของผู้เล่น
    const [lottos] = await db.query(
      "SELECT l.Lotto_id, l.Number FROM Lotto l WHERE l.Person_id = ?",
      [Person_id]
    );

    // 4. ตรวจรางวัล
    const results = lottos.map((lotto) => {
      const lottoNumber = lotto.Number;
      const winTypes = [];

      if (lottoNumber === prizes["1st"]) winTypes.push("รางวัลที่ 1");
      if (lottoNumber === prizes["2nd"]) winTypes.push("รางวัลที่ 2");
      if (lottoNumber === prizes["3rd"]) winTypes.push("รางวัลที่ 3");
      if (lottoNumber.slice(-3) === prizes["Last3"])
        winTypes.push("เลขท้าย 3 ตัว");
      if (lottoNumber.slice(-2) === prizes["Last2"])
        winTypes.push("เลขท้าย 2 ตัว");

      return {
        Lotto_id: lotto.Lotto_id,
        Number: lottoNumber,
        Win: winTypes,
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดตรวจรางวัล" });
  }
});

// ฟังก์ชันสำหรับดึงข้อมูลลอตเตอรี่ที่ลูกค้าซื้อไป
app.get("/sold-lotteries", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT T1.Number, T2.Person_id FROM Lotto AS T1 JOIN Purchase AS T2 ON T1.Lotto_id = T2.Lotto_id"
    );
    const soldLotteriesMap = {};
    for (const row of rows) {
      if (!soldLotteriesMap[row.Number]) {
        soldLotteriesMap[row.Number] = [];
      }
      soldLotteriesMap[row.Number].push(row.Person_id);
    }
    res.json({ success: true, soldLotteries: soldLotteriesMap });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลลอตเตอรี่",
    });
  }
});

// GET /lottos
app.get("/lottos", async (req, res) => {
  const { status, person_id } = req.query;

  try {
    if (!status || !person_id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ status และ person_id",
      });
    }

    const [rows] = await db.query(
      "SELECT lotto_id, number, status, person_id FROM Lotto WHERE status = ? AND person_id = ?",
      [status, person_id]
    );

    res.json({
      success: true,
      lotteries: rows,
    });
  } catch (err) {
    console.error("Error fetching lottos:", err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในระบบ",
    });
  }
});

//GET LOTTO
app.get("/lotto", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT Lotto_id, Number, Status, Price, Person_id FROM Lotto WHERE Status='Available'"
    );
    res.json({ lottos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/lotto/buy", async (req, res) => {
  const { Person_id, Lotto_id } = req.body;

  const conn = await db.getConnection();
  try {
    // เริ่ม Transaction
    await conn.beginTransaction();

    // ดึงข้อมูล Lotto
    const [lottoRows] = await conn.query(
      "SELECT Price, Status FROM Lotto WHERE Lotto_id=? FOR UPDATE",
      [Lotto_id]
    );

    if (lottoRows.length === 0) {
      await conn.rollback();
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบล็อตเตอรี่" });
    }

    const lotto = lottoRows[0];
    if ((lotto.Status ?? "").toLowerCase() !== "available") {
      await conn.rollback();
      return res
        .status(400)
        .json({ success: false, message: "ล็อตเตอรี่นี้ถูกซื้อแล้ว" });
    }

    const price = parseFloat(lotto.Price);
    if (isNaN(price) || price <= 0) {
      await conn.rollback();
      return res
        .status(400)
        .json({ success: false, message: "ราคา Lotto ไม่ถูกต้อง" });
    }

    // ตรวจสอบยอดเงิน
    const [walletRows] = await conn.query(
      "SELECT Wallet_balance FROM Person WHERE Person_id=? FOR UPDATE",
      [Person_id]
    );
    const wallet = parseFloat(walletRows[0].Wallet_balance);
    if (wallet < price) {
      await conn.rollback();
      return res
        .status(400)
        .json({ success: false, message: "ยอดเงินไม่เพียงพอ" });
    }

    // ลดเงิน
    await conn.query(
      "UPDATE Person SET Wallet_balance=Wallet_balance-? WHERE Person_id=?",
      [price, Person_id]
    );

    // อัพเดทสถานะ Lotto
    await conn.query(
      "UPDATE Lotto SET Status='Sold', Person_id=? WHERE Lotto_id=?",
      [Person_id, Lotto_id]
    );

    // บันทึกการซื้อ
    await conn.query(
      "INSERT INTO Purchase (Amount_paid, Purchase_date, Person_id, Lotto_id) VALUES (?, NOW(), ?, ?)",
      [price, Person_id, Lotto_id]
    );

    await conn.commit();
    res.json({ success: true, message: "ซื้อล็อตเตอรี่สำเร็จ" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

//GET WALLET 
app.get("/wallet/:Person_id", async (req, res) => {
  const { Person_id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT Wallet_balance FROM Person WHERE Person_id=?",
      [Person_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    res.json({ wallet_balance: rows[0].Wallet_balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//GET LATEST PRIZES 
app.get("/prizes/latest", async (req, res) => {
  try {
    // ดึง Winning_results ล่าสุด
    const [latestResult] = await db.query(
      "SELECT Result_id FROM Winning_results ORDER BY Draw_date DESC LIMIT 1"
    );

    if (latestResult.length === 0) return res.json({ prizes: {} });

    const resultId = latestResult[0].Result_id;

    // ดึงรางวัลจาก Winning_Prizes + Prize
    const [prizes] = await db.query(
      `SELECT p.Prize_type, p.Reward_amount
       FROM Winning_Prizes wp
       JOIN Prize p ON wp.Prize_id = p.Prize_id
       WHERE wp.Result_id = ?`,
      [resultId]
    );

    const prizeObj = {};
    for (const p of prizes) {
      if (p.Prize_type === "1st") prizeObj.prize1 = p.Reward_amount.toString();
      else if (p.Prize_type === "2nd")
        prizeObj.prize2 = p.Reward_amount.toString();
      else if (p.Prize_type === "3rd")
        prizeObj.prize3 = p.Reward_amount.toString();
      else if (p.Prize_type === "Last3")
        prizeObj.last3Digits = p.Reward_amount.toString();
      else if (p.Prize_type === "Last2")
        prizeObj.last2Digits = p.Reward_amount.toString();
    }

    res.json({ prizes: prizeObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/my-lottos/:personId", async (req, res) => {
  const { personId } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT l.Lotto_id, l.Number, l.Price
       FROM Lotto l
       WHERE l.Person_id = ? AND l.Status='Sold'`,
      [personId]
    );
    res.json({ success: true, lottos: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ หา IP เครื่อง
let ip = "0.0.0.0";
const interfaces = os.networkInterfaces();
for (const iface of Object.values(interfaces)) {
  for (const alias of iface) {
    if (alias.family === "IPv4" && !alias.internal) {
      ip = alias.address;
    }
  }
}

// POST /reset-all
// POST /reset-all
app.post("/reset-all", async (req, res) => {
  try {
    // ลบ Purchase ที่เกี่ยวข้องกับ Lotto ของผู้ใช้ไม่ใช่ Typeuser=2
    await db.query(`
      DELETE p
      FROM Purchase p
      JOIN Lotto l ON p.Lotto_id = l.Lotto_id
      JOIN Person pe ON l.Person_id = pe.Person_id
      WHERE pe.Typeuser != 2
    `);

    // ✅ ลบ Lotto ของผู้ใช้ที่ไม่ใช่ Typeuser=2
    await db.query(`
      DELETE l
      FROM Lotto l
      JOIN Person pe ON l.Person_id = pe.Person_id
      WHERE pe.Typeuser != 2
    `);

    // ลบ Admin ของผู้ใช้ที่ไม่ใช่ Typeuser=2
    await db.query(`
      DELETE a
      FROM Admin a
      JOIN Person pe ON a.Person_id = pe.Person_id
      WHERE pe.Typeuser != 2
    `);

    // ลบ Person ที่ไม่ใช่ Typeuser=2
    await db.query(`
      DELETE FROM Person
      WHERE Typeuser != 2
    `);

    // 🟡 ล้าง Lotto ทั้งหมด (อันนี้อาจไม่จำเป็นแล้ว เพราะลบไปด้านบน)
    // await db.query("DELETE FROM Lotto;")

    res.json({ success: true, message: "ล้างข้อมูลเรียบร้อยแล้ว (เว้น Typeuser=2)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Mydatabase API listening at http://localhost:${PORT}`);
});
