import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSMsWU7JUvphFcRtAvTdUoic_GL5DIGZo",
  authDomain: "reaksiyabattle.firebaseapp.com",
  databaseURL: "https://reaksiyabattle-default-rtdb.firebaseio.com",
  projectId: "reaksiyabattle",
  storageBucket: "reaksiyabattle.firebasestorage.app",
  messagingSenderId: "361932297858",
  appId: "1:361932297858:web:2bd381acd26bda53e2069b",
  measurementId: "G-5Q2008PQY0"
};

const ilova = initializeApp(firebaseConfig);
const auth = getAuth(ilova);
const baza = getDatabase(ilova);
const $ = id => document.getElementById(id);

let foydalanuvchi = null;
let profil = null;
let xonaKodi = null;
let xonaMalumoti = null;
let xonaKuzatuvchi = null;
let rekordKuzatuvchi = null;
let bosishMumkin = false;
let raundBoshlandi = false;
let raundNatijasiYuborildi = false;
let taymer = null;
let oxirgiRaund = 0;

let yakkaRaund = 0;
let yakkaVaqt = 0;
let yakkaTimer = null;
let yakkaFaol = false;
let yakkaNatijalar = [];
let yakkaBosilgan = false;
let yakkaTayyor = false;
let yakkaTugagan = false;

function xabar(id, matn, xato = false) {
  $(id).textContent = matn;
  $(id).style.color = xato ? "#ff8498" : "#a9ffd0";
}

function nomniTekshir(nom) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nom);
}

function emailYasash(nom) {
  return nom.toLowerCase() + "@reaksiya-login.com";
}

function bugungiSana() {
  const hozir = new Date();
  return `${hozir.getFullYear()}-${String(hozir.getMonth() + 1).padStart(2, "0")}-${String(hozir.getDate()).padStart(2, "0")}`;
}

function vaqt(ms) {
  return ms == null ? "—" : `${ms} ms`;
}

function kutish(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* RO‘YXATDAN O‘TISH */

$("royxatBtn").addEventListener("click", async () => {
  const nom = $("ism").value.trim();
  const parol = $("parol").value;

  if (!nomniTekshir(nom)) {
    xabar("authXabar", "Ism 3–20 belgidan iborat bo‘lsin. Harf, raqam va _ ishlating.", true);
    return;
  }

  if (parol.length < 6) {
    xabar("authXabar", "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.", true);
    return;
  }

  try {
    const natija = await createUserWithEmailAndPassword(
      auth,
      emailYasash(nom),
      parol
    );

    await set(ref(baza, `users/${natija.user.uid}`), {
      username: nom,
      createdAt: Date.now()
    });

    xabar("authXabar", "Akkaunt yaratildi!");
  } catch (xato) {
    xabar(
      "authXabar",
      xato.code === "auth/email-already-in-use"
        ? "Bu nom band. Boshqa nom tanlang yoki akkauntingizga kiring."
        : "Ro‘yxatdan o‘tib bo‘lmadi: " + xato.message,
      true
    );
  }
});

/* TIZIMGA KIRISH */

$("kirishBtn").addEventListener("click", async () => {
  const nom = $("ism").value.trim();
  const parol = $("parol").value;

  if (!nomniTekshir(nom) || !parol) {
    xabar("authXabar", "Ism va parolni to‘g‘ri kiriting.", true);
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, emailYasash(nom), parol);
  } catch (xato) {
    xabar("authXabar", "Kirish amalga oshmadi. Ism yoki parolni tekshiring.", true);
  }
});

/* FOYDALANUVCHI HOLATI */

onAuthStateChanged(auth, async user => {
  foydalanuvchi = user;

  if (!user) {
    profil = null;
    $("kirishQismi").classList.remove("yashirin");
    $("oyinQismi").classList.add("yashirin");

    xonaKuzatishiniToxtat();
    rekordlarniKuzatishiniToxtat();
    yakkaToxta();

    return;
  }

  try {
    const snapshot = await get(ref(baza, `users/${user.uid}`));

    if (!snapshot.exists()) {
      await signOut(auth);
      xabar("authXabar", "Foydalanuvchi ma’lumoti topilmadi. Qayta ro‘yxatdan o‘ting.", true);
      return;
    }

    profil = snapshot.val();

    $("kirishQismi").classList.add("yashirin");
    $("oyinQismi").classList.remove("yashirin");
    $("oyinchiIsmi").textContent = profil.username;

    await rekordlarniYuklash();
    rekordlarniKuzatish();
  } catch (xato) {
    xabar("authXabar", "Ma’lumotlarni yuklab bo‘lmadi. Firebase sozlamalarini tekshiring.", true);
  }
});

$("chiqishBtn").addEventListener("click", async () => {
  xonaKuzatishiniToxtat();
  yakkaToxta();
  await signOut(auth);
});

/* REKORDLAR */

async function rekordlarniYuklash() {
  if (!foydalanuvchi) return;

  const snapshot = await get(ref(baza, `scores/${foydalanuvchi.uid}`));
  const data = snapshot.val() || {};

  $("rekord").textContent = vaqt(data.best);
  $("bugungiRekord").textContent =
    data.day === bugungiSana() ? vaqt(data.dailyBest) : "—";
}

function rekordlarniKuzatish() {
  rekordlarniKuzatishiniToxtat();

  if (!foydalanuvchi) return;

  rekordKuzatuvchi = onValue(ref(baza, "scores"), snapshot => {
    const hammasi = snapshot.val() || {};

    const royxat = Object.values(hammasi)
      .filter(data => data && Number.isFinite(data.best))
      .map(data => ({
        nom: data.username || "O‘yinchi",
        best: data.best
      }))
      .sort((a, b) => a.best - b.best)
      .slice(0, 10);

    const ol = $("rekordlar");
    ol.replaceChildren();

    if (!royxat.length) {
      const li = document.createElement("li");
      li.textContent = "Hozircha rekordlar yo‘q.";
      ol.appendChild(li);
      return;
    }

    royxat.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${index + 1}. ${item.nom} — ${item.best} ms`;
      ol.appendChild(li);
    });
  });
}

function rekordlarniKuzatishiniToxtat() {
  if (rekordKuzatuvchi) rekordKuzatuvchi();
  rekordKuzatuvchi = null;
}

async function rekordSaqlash(ms) {
  if (!foydalanuvchi || !Number.isFinite(ms) || ms < 0) return;

  const manzil = ref(baza, `scores/${foydalanuvchi.uid}`);
  const sana = bugungiSana();

  await runTransaction(manzil, eski => {
    eski = eski || {};

    const oldBest = Number.isFinite(eski.best) ? eski.best : null;
    const oldDaily =
      eski.day === sana && Number.isFinite(eski.dailyBest)
        ? eski.dailyBest
        : null;

    return {
      username: profil.username,
      best: oldBest === null ? ms : Math.min(oldBest, ms),
      day: sana,
      dailyBest: oldDaily === null ? ms : Math.min(oldDaily, ms)
    };
  });

  await rekordlarniYuklash();
}

/* O‘YIN REJIMLARINI TANLASH */

$("birKishiBtn").addEventListener("click", () => {
  $("yakkaQismi").classList.remove("yashirin");
  $("ikkiKishiQismi").classList.add("yashirin");
  $("jangQismi").classList.add("yashirin");

  if (yakkaRaund === 0 && !yakkaNatijalar.length) {
    yakkaYangiOyin();
  }
});

$("ikkiKishiBtn").addEventListener("click", () => {
  $("ikkiKishiQismi").classList.remove("yashirin");
  $("yakkaQismi").classList.add("yashirin");
});

$("yakkaChiqBtn").addEventListener("click", () => {
  yakkaToxta();
  $("yakkaQismi").classList.add("yashirin");
});

/* 1 KISHILIK REJIM */

function yakkaToxta() {
  clearTimeout(yakkaTimer);
  yakkaTimer = null;
  yakkaFaol = false;
  yakkaBosilgan = false;
}

function yakkaYangila() {
  const natijalar = yakkaNatijalar.filter(n => n !== null);

  $("yakkaRaund").textContent =
    `${Math.min(Math.max(yakkaRaund, 1), 3)}/3`;

  $("yakkaEngTez").textContent = natijalar.length
    ? Math.min(...natijalar) + " ms"
    : "—";
}

function yakkaYangiOyin() {
  yakkaToxta();

  yakkaRaund = 0;
  yakkaNatijalar = [];
  yakkaTayyor = false;
  yakkaTugagan = false;

  $("yakkaQaytaBtn").classList.add("yashirin");
  $("yakkaBoshlashBtn").classList.remove("yashirin");
  $("yakkaBoshlashBtn").disabled = false;
  $("yakkaBoshlashBtn").textContent = "BOSHLASH";

  $("yakkaHolati").textContent = "Boshlash tugmasini bosing.";
  $("yakkaSignal").className = "signal";
  $("yakkaSignal").textContent = "⚡";
  $("yakkaKorsatma").textContent =
    "Yashil signal chiqquncha kuting, keyin tez bosing!";

  yakkaYangila();
}

function yakkaRaundBoshlash() {
  if (yakkaRaund >= 3) return;

  yakkaRaund++;
  yakkaTayyor = false;
  yakkaFaol = true;
  yakkaBosilgan = false;

  yakkaYangila();

  $("yakkaBoshlashBtn").textContent = "BOS!";
  $("yakkaHolati").textContent = `${yakkaRaund}-raund: kuting...`;
  $("yakkaSignal").className = "signal kutish";
  $("yakkaSignal").textContent = "⏳";
  $("yakkaKorsatma").textContent = "Yashil signal chiqmaguncha bosmang!";

  clearTimeout(yakkaTimer);

  yakkaTimer = setTimeout(() => {
    if (!yakkaFaol || yakkaBosilgan) return;

    yakkaVaqt = Date.now();

    $("yakkaSignal").className = "signal bos";
    $("yakkaSignal").textContent = "🟢";
    $("yakkaHolati").textContent = "HOZIR BOSING!";
    $("yakkaKorsatma").textContent = "Yashil signal chiqdi — tez bosing!";
  }, 1800 + Math.random() * 3000);
}

async function yakkaNatijaniBosish() {
  if (!yakkaFaol || yakkaBosilgan) return;

  yakkaBosilgan = true;
  yakkaFaol = false;
  yakkaTayyor = true;

  clearTimeout(yakkaTimer);

  if ($("yakkaSignal").classList.contains("bos")) {
    const ms = Date.now() - yakkaVaqt;

    yakkaNatijalar.push(ms);

    $("yakkaSignal").className = "signal bos";
    $("yakkaSignal").textContent = "⚡";
    $("yakkaHolati").textContent = `Natijangiz: ${ms} ms`;
    $("yakkaKorsatma").textContent =
      "Natija qayd etildi. Davom etish uchun tugmani bosing.";

    try {
      await rekordSaqlash(ms);
    } catch (xato) {
      console.error("Rekord saqlashda xatolik:", xato);
    }
  } else {
    yakkaNatijalar.push(null);

    $("yakkaSignal").className = "signal xato";
    $("yakkaSignal").textContent = "✖";
    $("yakkaHolati").textContent =
      "Juda erta bosdingiz! Raund yutqazildi.";
    $("yakkaKorsatma").textContent =
      "Keyingi raund uchun tugmani bosing.";
  }

  yakkaYangila();

  $("yakkaBoshlashBtn").textContent =
    yakkaRaund < 3 ? "KEYINGI RAUND" : "NATIJANI KO‘RISH";
}

function yakkaYakun() {
  const natijalar = yakkaNatijalar.filter(n => n !== null);

  $("yakkaHolati").textContent = natijalar.length
    ? `O‘yin tugadi! Eng yaxshi natijangiz: ${Math.min(...natijalar)} ms`
    : "O‘yin tugadi. Yana urinib ko‘ring!";

  $("yakkaKorsatma").textContent =
    "Raundlar: " +
    yakkaNatijalar
      .map((n, i) => `${i + 1}: ${n === null ? "erta bosildi" : n + " ms"}`)
      .join(" | ");

  yakkaTugagan = true;
  $("yakkaBoshlashBtn").textContent = "QAYTA O‘YNASH";
}

$("yakkaBoshlashBtn").addEventListener("click", () => {
  if (yakkaFaol) {
    yakkaNatijaniBosish();
    return;
  }

  if (yakkaTugagan) {
    yakkaYangiOyin();
    return;
  }

  if (yakkaRaund === 0 || (yakkaTayyor && yakkaRaund < 3)) {
    yakkaRaundBoshlash();
    return;
  }

  if (yakkaTayyor && yakkaRaund >= 3) {
    yakkaYakun();
  }
});

$("yakkaSignal").addEventListener("click", () => {
  if (yakkaFaol) yakkaNatijaniBosish();
});

$("yakkaQaytaBtn").addEventListener("click", yakkaYangiOyin);

/* 2 KISHILIK REJIM — FIREBASE XONALARI */

function yangiKod() {
  const belgilar = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let kod = "";

  for (let i = 0; i < 6; i++) {
    kod += belgilar[Math.floor(Math.random() * belgilar.length)];
  }

  return kod;
}

$("xonaYaratBtn").addEventListener("click", async () => {
  if (!foydalanuvchi) return;

  try {
    let kod;
    let mavjud = true;

    for (let i = 0; i < 5; i++) {
      kod = yangiKod();
      const snapshot = await get(ref(baza, `rooms/${kod}`));

      if (!snapshot.exists()) {
        mavjud = false;
        break;
      }
    }

    if (mavjud) {
      xabar("xonaXabar", "Xona yaratilmadi. Yana urinib ko‘ring.", true);
      return;
    }

    const yangiXona = {
      host: foydalanuvchi.uid,
      guest: "",
      status: "waiting",
      round: 1,
      startAt: 0,
      scores: {
        [foydalanuvchi.uid]: 0
      },
      results: {},
      resolvedRound: 0,
      createdAt: Date.now()
    };

    await set(ref(baza, `rooms/${kod}`), yangiXona);

    xonaKodi = kod;
    xonaKuzatishniBoshlash(kod);

    xabar("xonaXabar", "Xona yaratildi! Kodni do‘stingizga yuboring.");
  } catch (xato) {
    xabar("xonaXabar", "Xona yaratilmadi. Firebase Rules sozlamalarini tekshiring.", true);
  }
});

$("xonaQoshBtn").addEventListener("click", async () => {
  const kod = $("xonaKodi").value.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(kod)) {
    xabar("xonaXabar", "6 belgili xona kodini kiriting.", true);
    return;
  }

  if (!foydalanuvchi) return;

  try {
    const manzil = ref(baza, `rooms/${kod}`);
    const snapshot = await get(manzil);

    if (!snapshot.exists()) {
      xabar("xonaXabar", "Bunday xona topilmadi.", true);
      return;
    }

    const xona = snapshot.val();

    if (xona.host === foydalanuvchi.uid) {
      xonaKodi = kod;
      xonaKuzatishniBoshlash(kod);
      return;
    }

    if (xona.guest && xona.guest !== foydalanuvchi.uid) {
      xabar("xonaXabar", "Bu xona allaqachon to‘lgan.", true);
      return;
    }

    if (xona.status !== "waiting") {
      xabar("xonaXabar", "Bu jang allaqachon boshlangan.", true);
      return;
    }

    const yangilash = {};
    yangilash[`rooms/${kod}/guest`] = foydalanuvchi.uid;
    yangilash[`rooms/${kod}/scores/${foydalanuvchi.uid}`] = 0;

    await update(ref(baza), yangilash);

    xonaKodi = kod;
    xonaKuzatishniBoshlash(kod);

    xabar("xonaXabar", "Xonaga qo‘shildingiz!");
  } catch (xato) {
    xabar("xonaXabar", "Xonaga qo‘shilib bo‘lmadi. Firebase sozlamalarini tekshiring.", true);
  }
});

$("nusxaBtn").addEventListener("click", async () => {
  if (!xonaKodi) return;

  try {
    await navigator.clipboard.writeText(xonaKodi);
    xabar("xonaXabar", "Xona kodi nusxalandi: " + xonaKodi);
  } catch {
    xabar("xonaXabar", "Xona kodi: " + xonaKodi);
  }
});

function xonaKuzatishiniToxtat() {
  if (xonaKuzatuvchi) xonaKuzatuvchi();

  xonaKuzatuvchi = null;

  clearTimeout(taymer);
  taymer = null;

  xonaKodi = null;
  xonaMalumoti = null;
  bosishMumkin = false;
  raundBoshlandi = false;
  raundNatijasiYuborildi = false;
  oxirgiRaund = 0;

  $("jangQismi").classList.add("yashirin");
}

function xonaKuzatishniBoshlash(kod) {
  xonaKuzatishiniToxtat();

  xonaKodi = kod;
  $("jangQismi").classList.remove("yashirin");
  $("jangKodi").textContent = kod;

  xonaKuzatuvchi = onValue(ref(baza, `rooms/${kod}`), async snapshot => {
    if (!snapshot.exists()) {
      xabar("xonaXabar", "Xona topilmadi yoki o‘chirildi.", true);
      xonaKuzatishiniToxtat();
      return;
    }

    xonaMalumoti = snapshot.val();
    ekranniYangilash();

    if (
      foydalanuvchi.uid === xonaMalumoti.host &&
      xonaMalumoti.guest &&
      xonaMalumoti.status === "waiting"
    ) {
      await raundniBoshlash(1);
    }

    if (xonaMalumoti.status === "playing") {
      signalniRejalash();

      if (foydalanuvchi.uid === xonaMalumoti.host) {
        await raundniTekshirish();
      }
    }

    if (xonaMalumoti.status === "between") {
      clearTimeout(taymer);
      bosishMumkin = false;

      $("reaksiyaBtn").disabled = true;
      $("reaksiyaBtn").textContent = "RAUND TUGADI";
      $("signal").className = "signal";
      $("signal").textContent = "✓";

      $("oyinKorsatma").textContent =
        foydalanuvchi.uid === xonaMalumoti.host
          ? "Keyingi raundni boshlash uchun tugmani bosing."
          : "Raqib keyingi raundni boshlashini kuting.";

      $("keyingiBtn").classList.toggle(
        "yashirin",
        foydalanuvchi.uid !== xonaMalumoti.host
      );
    }

    if (xonaMalumoti.status === "finished") {
      clearTimeout(taymer);
      bosishMumkin = false;

      $("reaksiyaBtn").disabled = true;
      $("keyingiBtn").classList.add("yashirin");
      $("jangHolati").textContent = "JANG YAKUNLANDI";

      const men = xonaMalumoti.scores?.[foydalanuvchi.uid] || 0;
      const raqibUid =
        xonaMalumoti.host === foydalanuvchi.uid
          ? xonaMalumoti.guest
          : xonaMalumoti.host;
      const raqib = xonaMalumoti.scores?.[raqibUid] || 0;

      $("oyinKorsatma").textContent =
        men > raqib
          ? "🏆 Siz g‘alaba qozondingiz!"
          : men < raqib
            ? "Raqib g‘alaba qozondi. Yana urinib ko‘ring!"
            : "Durang!";

      $("signal").textContent = "🏆";
    }
  });
}

function ekranniYangilash() {
  const xona = xonaMalumoti;
  if (!xona || !foydalanuvchi) return;

  const raqibUid =
    xona.host === foydalanuvchi.uid ? xona.guest : xona.host;

  $("menNomi").textContent = profil.username;
  $("raqibNomi").textContent = raqibUid ? "Raqib" : "Raqib";
  $("menHisob").textContent = xona.scores?.[foydalanuvchi.uid] || 0;
  $("raqibHisob").textContent = xona.scores?.[raqibUid] || 0;
  $("raundRaqam").textContent = xona.round || 1;
  $("jangKodi").textContent = xonaKodi;

  if (!xona.guest) {
    $("jangHolati").textContent = "Raqib kutilmoqda...";
    $("oyinKorsatma").textContent = "Xona kodini do‘stingizga yuboring.";
    $("signal").className = "signal";
    $("signal").textContent = "⚡";
    $("reaksiyaBtn").disabled = true;
    $("reaksiyaBtn").textContent = "RAQIB KUTILMOQDA";
  } else if (xona.status === "playing") {
    $("jangHolati").textContent = "Raqib bilan jang!";
  }
}

async function raundniBoshlash(raqam) {
  if (!xonaKodi || !foydalanuvchi || !xonaMalumoti) return;
  if (foydalanuvchi.uid !== xonaMalumoti.host) return;
  if (!xonaMalumoti.guest) return;
  if (xonaMalumoti.status === "playing") return;

  const boshlanish = Date.now() + 3000 + Math.floor(Math.random() * 2000);

  try {
    await update(ref(baza, `rooms/${xonaKodi}`), {
      status: "playing",
      round: raqam,
      startAt: boshlanish,
      results: {},
      resolvedRound: raqam - 1
    });
  } catch (xato) {
    xabar("xonaXabar", "Raundni boshlashda xatolik yuz berdi.", true);
  }
}

function signalniRejalash() {
  const xona = xonaMalumoti;
  if (!xona || xona.status !== "playing") return;

  if (oxirgiRaund !== xona.round) {
    oxirgiRaund = xona.round;
    raundBoshlandi = false;
    raundNatijasiYuborildi = false;
    bosishMumkin = false;

    clearTimeout(taymer);

    $("signal").className = "signal";
    $("signal").textContent = "⏳";
    $("reaksiyaBtn").disabled = false;
    $("reaksiyaBtn").textContent = "KUTING...";
    $("oyinKorsatma").textContent =
      "Yashil signal chiqishini kuting. Erta bosmang!";
  }

  if (raundBoshlandi) return;
  raundBoshlandi = true;

  taymer = setTimeout(() => {
    if (
      !xonaMalumoti ||
      xonaMalumoti.status !== "playing" ||
      xonaMalumoti.round !== xona.round
    ) {
      return;
    }

    bosishMumkin = true;
    $("signal").className = "signal bos";
    $("signal").textContent = "🟢";
    $("reaksiyaBtn").textContent = "BOS!";
    $("oyinKorsatma").textContent = "HOZIR BOSING!";
  }, Math.max(0, xona.startAt - Date.now()));
}

$("reaksiyaBtn").addEventListener("click", async () => {
  if (!foydalanuvchi || !xonaKodi || !xonaMalumoti) return;
  if (xonaMalumoti.status !== "playing" || raundNatijasiYuborildi) return;

  raundNatijasiYuborildi = true;
  bosishMumkin = false;
  $("reaksiyaBtn").disabled = true;

  let natija;

  if (Date.now() < xonaMalumoti.startAt) {
    natija = {
      early: true,
      ms: null,
      at: Date.now()
    };

    $("signal").className = "signal xato";
    $("signal").textContent = "✖";
    $("oyinKorsatma").textContent =
      "Juda erta bosdingiz! Bu raund yutqazildi.";
  } else {
    const ms = Date.now() - xonaMalumoti.startAt;

    natija = {
      early: false,
      ms,
      at: Date.now()
    };

    $("signal").className = "signal bos";
    $("signal").textContent = "⚡";
    $("oyinKorsatma").textContent = `Reaksiya vaqtingiz: ${ms} ms`;

    await rekordSaqlash(ms);
  }

  try {
    await set(
      ref(
        baza,
        `rooms/${xonaKodi}/results/${xonaMalumoti.round}/${foydalanuvchi.uid}`
      ),
      natija
    );

    $("reaksiyaBtn").textContent = "NATIJA YUBORILDI";

    if (foydalanuvchi.uid === xonaMalumoti.host) {
      await raundniTekshirish();
    }
  } catch (xato) {
    raundNatijasiYuborildi = false;
    xabar("xonaXabar", "Natija saqlanmadi. Firebase Rules ni tekshiring.", true);
  }
});

async function raundniTekshirish() {
  if (!xonaKodi || !xonaMalumoti || !foydalanuvchi) return;
  if (foydalanuvchi.uid !== xonaMalumoti.host) return;
  if (xonaMalumoti.status !== "playing") return;

  const xonaSnap = await get(ref(baza, `rooms/${xonaKodi}`));
  if (!xonaSnap.exists()) return;

  const xona = xonaSnap.val();
  if (xona.status !== "playing") return;

  const raundNatijalari = xona.results?.[xona.round] || {};
  const a = raundNatijalari[xona.host];
  const b = raundNatijalari[xona.guest];

  if (!a || !b || xona.resolvedRound === xona.round) return;

  let hostBall = xona.scores?.[xona.host] || 0;
  let guestBall = xona.scores?.[xona.guest] || 0;

  if (a.early && !b.early) {
    guestBall++;
  } else if (b.early && !a.early) {
    hostBall++;
  } else if (!a.early && !b.early) {
    if (a.ms < b.ms) hostBall++;
    else if (b.ms < a.ms) guestBall++;
  }

  const yakunlandi =
    xona.round >= 3 || hostBall >= 2 || guestBall >= 2;

  try {
    await runTransaction(ref(baza, `rooms/${xonaKodi}`), eski => {
      if (
        !eski ||
        eski.status !== "playing" ||
        eski.round !== xona.round ||
        eski.resolvedRound === xona.round
      ) {
        return;
      }

      eski.scores = eski.scores || {};
      eski.scores[eski.host] = hostBall;
      eski.scores[eski.guest] = guestBall;
      eski.resolvedRound = eski.round;
      eski.status = yakunlandi ? "finished" : "between";

      return eski;
    });
  } catch (xato) {
    console.error("Raund natijasini hisoblash xatosi:", xato);
  }
}

$("keyingiBtn").addEventListener("click", async () => {
  if (!xonaKodi || !xonaMalumoti || !foydalanuvchi) return;
  if (foydalanuvchi.uid !== xonaMalumoti.host) return;
  if (xonaMalumoti.status !== "between") return;

  await raundniBoshlash(xonaMalumoti.round + 1);
});

$("jangniTugatBtn").addEventListener("click", () => {
  xonaKuzatishiniToxtat();
  xabar("xonaXabar", "Xonadan chiqdingiz.");
});