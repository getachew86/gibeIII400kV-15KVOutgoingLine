// 🛑 የእርስዎን Firebase config መረጃ እዚህ ይተኩ!
const firebaseConfig = {
    apiKey: "AIzaSyCAnvA4yM9Mr56aZfPHM8uAeZs_n2vucf0",
    authDomain: "gibeiiioutgoingline.firebaseapp.com",
    projectId: "gibeiiioutgoingline",
    storageBucket: "gibeiiioutgoingline.firebasestorage.app",
    messagingSenderId: "455001056354",
    appId: "1:455001056354:web:9b94e5fb577a5d185a1d3b",
    measurementId: "G-L986PBVVDY"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isAdmin = false;

// Generate 1:00 to 24:00 Rows dynamically
const tbody = document.getElementById('hourlyTableBody');
for (let h = 1; h <= 24; h++) {
    const displayTime = h === 24 ? "0:00" : `${h}:00`;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td class="border p-1 font-bold text-center bg-gray-50">${displayTime}</td>
        <td class="border p-1"><input type="number" id="bus_v_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
        <td class="border p-1"><input type="number" id="freq_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
        <td class="border p-1"><input type="number" id="s1_act_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
        <td class="border p-1"><input type="number" id="s1_react_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
        <td class="border p-1"><input type="number" id="s2_act_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
        <td class="border p-1"><input type="number" id="s2_react_${h}" onchange="autoSaveRow(${h})" class="w-full p-1 text-center"></td>
    `;
    tbody.appendChild(row);
}

// 1. User Login Function
function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            setupUserRole(userCredential.user);
            fetchPrecedingReading(); // የቀደመውን ቀን ዳታ ለማምጣት
        })
        .catch((error) => {
            document.getElementById('loginError').classList.remove('hidden');
        });
}

// 7. Role Management (Admin Only Check)
function setupUserRole(user) {
    currentUser = user;
    document.getElementById('userBadge').innerText = `Logged in: ${user.email}`;
    
    // በኢሜይል አድራሻው ላይ በመመስረት አድሚን መሆኑን ማረጋገጥ (ለምሳሌ በ @gibe3.gov.et ካለቀ)
    if (user.email.includes('admin')) {
        isAdmin = true;
        document.getElementById('submitBtn').classList.remove('hidden');
        document.getElementById('deleteBtn').classList.remove('hidden');
        document.getElementById('adminStatusText').innerText = "የአድሚን ፍቃድ ተሰጥቶታል (Admin Access Granted)";
        document.getElementById('adminStatusText').className = "text-sm text-green-600 font-bold";
    }
}

// 🔄 Auto-save Row to LocalStorage (ከ 1:00 እስከ 24:00 በራሱ ፎርሙ ላይ እንዲቀመጥ)
function autoSaveRow(hour) {
    const rowData = {
        bus_v: document.getElementById(`bus_v_${hour}`).value,
        freq: document.getElementById(`freq_${hour}`).value,
        s1_act: document.getElementById(`s1_act_${hour}`).value,
        s1_react: document.getElementById(`s1_react_${hour}`).value
    };
    localStorage.setItem(`row_hour_${hour}`, JSON.stringify(rowData));
}

// 🧮 Meter Calculations (Present - Preceding = Difference)
function calculateDifference() {
    const present = parseFloat(document.getElementById('s1_pres_mwh').value) || 0;
    const preceding = parseFloat(document.getElementById('s1_prec_mwh').value) || 0;
    
    const difference = present - preceding;
    document.getElementById('s1_diff_mwh').value = difference.toFixed(2);
    document.getElementById('s1_output_mwh').value = difference.toFixed(2); // Today's output
}

// 📅 Present Readingን ወደ ቀጣዩ ቀን Preceding Reading የማስተላለፍ ስራ
function fetchPrecedingReading() {
    // ከትናንትናው የመጨረሻ የደረሰበትን የ Present Reading መረጃ ከፊልድ ያመጣል
    db.collection("logsheets").orderBy("dateGC", "desc").limit(1).get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                const lastDoc = querySnapshot.docs[0].data();
                // የትላንቱ Present ዛሬ Preceding ይሆናል
                document.getElementById('s1_prec_mwh').value = lastDoc.energyMeter?.s1_pres_mwh || 0;
                calculateDifference();
            } else {
                document.getElementById('s1_prec_mwh').value = 0;
            }
        });
}

// 📤 Submit All Data to Firebase
function submitToFirebase(e) {
    e.preventDefault();
    if (!isAdmin) return alert("ይቅርታ፣ መረጃ ለመላክ የአድሚን ፍቃድ ያስፈልጋል!");

    const dateGC = document.getElementById('dateGC').value;
    const dateEC = document.getElementById('dateEC').value;

    let hourlyData = {};
    for (let h = 1; h <= 24; h++) {
        hourlyData[`hour_${h}`] = {
            bus_v: document.getElementById(`bus_v_${h}`).value,
            freq: document.getElementById(`freq_${h}`).value,
            s1_act: document.getElementById(`s1_act_${h}`).value
        };
    }

    const energyMeter = {
        s1_pres_mwh: document.getElementById('s1_pres_mwh').value,
        s1_prec_mwh: document.getElementById('s1_prec_mwh').value,
        s1_diff_mwh: document.getElementById('s1_diff_mwh').value
    };

    db.collection("logsheets").doc(dateGC).set({
        dateEC,
        dateGC,
        hourlyData,
        energyMeter,
        submittedBy: currentUser.email,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("መረጃው በተሳካ ሁኔታ Firebase ላይ ተቀምጧል!");
        localStorage.clear(); // ፎርሙን ማጽዳት
    }).catch(err => alert("ስህተት አጋጥሟል: " + err));
}

// 6. Search Box Function
function searchDataByDate() {
    const sDate = document.getElementById('searchDate').value;
    if (!sDate) return alert("እባክዎ መጀመሪያ ቀን ይምረጡ!");

    db.collection("logsheets").doc(sDate).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('dateEC').value = data.dateEC;
            document.getElementById('dateGC').value = data.dateGC;
            
            // የተገኘውን መረጃ ፎርሙ ላይ መሙላት
            for (let h = 1; h <= 24; h++) {
                if(data.hourlyData[`hour_${h}`]) {
                    document.getElementById(`bus_v_${h}`).value = data.hourlyData[`hour_${h}`].bus_v;
                    document.getElementById(`freq_${h}`).value = data.hourlyData[`hour_${h}`].freq;
                    document.getElementById(`s1_act_${h}`).value = data.hourlyData[`hour_${h}`].s1_act;
                }
            }
            document.getElementById('s1_pres_mwh').value = data.energyMeter.s1_pres_mwh;
            document.getElementById('s1_prec_mwh').value = data.energyMeter.s1_prec_mwh;
            calculateDifference();
            alert("የተመረጠው ቀን መረጃ ተገኝቶ ፎርሙ ላይ ተሞልቷል!");
        } else {
            alert("በዚህ ቀን የተመዘገበ ዳታ አልተገኘም!");
        }
    });
}

// 5. Delete Function
function deleteCurrentRecord() {
    const dateGC = document.getElementById('dateGC').value;
    if (!dateGC) return alert("እባክዎ መጀመሪያ የሚጠፋውን ቀን ዳታ በሪሰርች ያውጡ!");
    
    if (confirm(`${dateGC} የተመዘገበውን ዳታ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?`)) {
        db.collection("logsheets").doc(dateGC).delete().then(() => {
            alert("መረጃው ተሰርዟል!");
            location.reload();
        });
    }
}

// 4. Excel Export Function
function exportToExcel() {
    let table = document.getElementById("logSheetForm");
    let wb = XLSX.utils.table_to_book(table, {sheet: "LogSheet"});
    XLSX.writeFile(wb, `Gibe3_LogSheet_${document.getElementById('dateGC').value || 'Export'}.xlsx`);
}

// 3. PDF Export Function
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.text("ETHIOPIAN ELECTRIC POWER - GIBE III LOG SHEET", 40, 40);
    // AutoTable በመጠቀም ቴብሉን ወደ PDF መቀየር
    doc.autoTable({ html: '#logSheetForm table', startY: 60 });
    doc.save(`Gibe3_LogSheet.pdf`);
}

function logoutUser() {
    auth.signOut().then(() => location.reload());
}