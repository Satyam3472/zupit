// Zupit Customer App - State Machine & Prototype Controller
// Zero Login, 1-Minute Order Flow, Jamui Bihar Health Logistics

const I18N = {
  en: {
    // Shared Top & Bottom Bars
    brand: "Zupit",
    langToggle: "हिन्दी / EN",
    supportTitle: "Need help?",
    supportSubtitle: "Our Jamui logistics support team is ready to assist you.",
    callUs: "Call us: +91 62078 56200",
    waUs: "WhatsApp us: +91 62078 56200",
    supportHours: "Open every day: 8:00 AM – 10:00 PM",
    close: "Close",
    navOrder: "Order",
    navTrack: "Track order",
    offlineNotice: "No internet. Your order is not placed yet.",

    // Screen 1: New Order
    heroTag: "Fast Jamui Delivery",
    heroHeading: "Medicines delivered to your door",
    heroSubhead: "Free delivery on every order. You pay after you see the bill.",
    
    // Returning Customer Card
    returningBadge: "Quick Reorder",
    returningPrompt: "Welcome back, {name}. Deliver to {address}, near {landmark}?",
    yesUseThis: "Yes, use this",
    change: "Change",

    // Section 1
    sec1Title: "What do you need?",
    tabType: "Type medicines",
    tabUpload: "Upload prescription",
    medNamePlaceholder: "Medicine name (e.g. Paracetamol)",
    medStrengthPlaceholder: "Strength / form (e.g. 650mg, 15 tabs)",
    addAnotherMed: "+ Add another medicine",
    brandNotesLabel: "Any brand preference or note?",
    brandNotesPlaceholder: "e.g., Any generic brand is fine, or call if brand differs",
    uploadTitle: "Take a photo or upload prescription",
    uploadCamera: "Camera",
    uploadGallery: "Gallery",
    uploadPrivacy: "Only you, your rider and Zupit can see this.",
    uploadFailMsg: "Upload failed. Check network & tap retry.",
    retryBtn: "Retry",
    rxConsentLabel: "I agree to Zupit using my prescription to fulfil this order.",
    rxConsentError: "Please agree to allow Zupit to use your prescription to fulfil this order.",

    // Section 2
    sec2Title: "Delivery details",
    nameLabel: "Full name",
    namePlaceholder: "Enter your full name",
    mobileLabel: "Mobile number",
    mobilePlaceholder: "10-digit mobile number",
    mobileHelper: "Your rider will call this number.",
    addressLabel: "House or flat, street or area",
    addressPlaceholder: "e.g. House 14, Station Road",
    landmarkLabel: "Landmark",
    landmarkPlaceholder: "Example: near Gandhi Chowk",
    landmarkHelper: "Helps the rider find you quickly",
    pincodeLabel: "Pincode",
    pincodePlaceholder: "6-digit pincode (e.g. 811307)",
    pincodeValidMsg: "Serviceable in Jamui (Delivery in 30-45 mins)",
    pincodeInvalidMsg: "We do not deliver to this area yet.",
    useLocationBtn: "Use my current location",

    // Section 3
    sec3Title: "Payment",
    payCodTitle: "Cash on delivery",
    payCodSub: "Pay in cash to the rider at your door",
    payOnlineTitle: "Pay online after bill",
    payOnlineSub: "Pay via UPI (GPay, PhonePe, Paytm) after rider sends the pharmacy bill",
    paymentAssurance: "You will see the exact bill before you pay.",
    btnPlaceOrder: "Place order",

    // Validation Errors
    errName: "Enter your full name",
    errMobile: "Enter a 10-digit mobile number starting with 6 to 9",
    errAddress: "Enter your house or street address",
    errLandmark: "Enter a nearby landmark for delivery",
    errPincode: "Enter a 6-digit pincode",
    errPincodeUnserviceable: "We do not deliver to this area yet.",
    errNoItems: "Please type at least one medicine or upload a prescription slip.",

    // Screen 2: Order Placed
    placedSuccess: "Order placed",
    placedConfirmMsg: "A Zupit rider will call you shortly to confirm.",
    placedSmsMsg: "We also sent the tracking link by SMS.",
    btnTrackOrder: "Track my order",
    btnCallUs: "Call us",
    summaryMedicines: "Medicines",
    summaryPrescription: "Prescription",
    summaryAddress: "Deliver to",
    summaryPayment: "Payment mode",

    // Screen 3: Track Order Entry
    trackEntryTitle: "Track order",
    trackEntrySub: "Enter mobile number and order ID to check status",
    recentOrderCardTitle: "Recent order on this device",
    trackMobileLabel: "Mobile number",
    trackIdLabel: "Order ID",
    btnTrackLookup: "Track order",
    trackErrorMsg: "We could not find this order. Check the number and try again.",
    noActiveOrders: "No recent orders found on this phone.",
    btnPlaceNewOrder: "Place an order",

    // Screen 4: Order Tracking
    statusStepPlaced: "Placed",
    statusStepAssigned: "Rider assigned",
    statusStepBuying: "Buying medicines",
    statusStepTransit: "Out for delivery",
    statusStepDelivered: "Delivered",
    statusStepCancelled: "Cancelled",
    
    riderAssignedTitle: "Assigned Delivery Rider",
    btnCallRider: "Call",
    btnWaRider: "WhatsApp",

    billCardTitle: "Pharmacy Bill Ready",
    billAmountLabel: "Total bill amount to pay",
    billPhotoTapText: "Tap to view pharmacy bill photo",
    btnPayNow: "Pay now",
    payCodToRider: "Pay ₹{amount} in cash to the rider",

    deliveryCodeTitle: "Tell this code to the rider",
    deliveryCodeHelper: "Rider will verify this 4-digit code at delivery",
    updatedJustNow: "Updated just now",

    trackNotFoundTitle: "Order Not Found",
    trackNotFoundMsg: "We could not find this order. Check the number and try again.",
    btnTrackAnother: "Track order",
    btnHome: "Home",

    orderDetailsTitle: "Order details",
    cancelOrderLink: "Cancel order",
    confirmCancelTitle: "Cancel order?",
    confirmCancelMsg: "Are you sure you want to cancel this order? The rider has not purchased items yet.",
    keepOrderBtn: "Keep order",
    yesCancelBtn: "Yes, cancel order",

    // Screen 5: Item Not Available
    unavailableTitle: "Item not available at pharmacy",
    unavailableNotice: "An item was not available at the pharmacy.",
    unavailableChoiceSkip: "Skip it",
    unavailableChoiceCall: "Call me",
    unavailableChoiceCancel: "Cancel order",
    btnSkipItem: "Skip it",
    btnCallMe: "Call me",
    btnCancelOrder: "Cancel order",

    // Screen 6: Payment
    paymentHeaderTitle: "Pay Pharmacy Bill",
    billTotalLabel: "Pharmacy bill total",
    deliveryFeeLabel: "Delivery fee",
    freeDelivery: "₹ 0 (Free)",
    totalPayableLabel: "Total payable",
    upiOptionsTitle: "Select UPI or Payment Mode",
    otherUpiLabel: "Other UPI ID",
    cardLabel: "Debit / Credit Card",
    btnPayAmount: "Pay ₹ {amount}",
    paymentProcessing: "Contacting payment gateway...",
    paymentSuccessTitle: "Payment successful!",
    paymentSuccessMsg: "₹ {amount} paid successfully. Receipt sent via SMS.",
    btnBackToTracking: "Back to tracking",
    paymentFailTitle: "Payment failed",
    paymentFailMsg: "Bank server did not respond. No money was deducted.",
    btnTryAgain: "Try again",
    btnPayCashInstead: "Pay cash instead",

    // Screen 7: Delivered
    deliveredTitle: "Medicines Delivered",
    deliveredSubtitle: "Thank you for trusting Zupit Jamui!",
    deliveredSummaryPaid: "Total bill paid:",
    rateExperience: "Rate your delivery experience",
    feedbackPlaceholder: "Any feedback for the rider or pharmacy? (Optional)",
    btnDone: "Done",
    btnOrderAgain: "Order again"
  },

  hi: {
    // Shared Top & Bottom Bars
    brand: "Zupit",
    langToggle: "EN / हिन्दी",
    supportTitle: "मदद चाहिए?",
    supportSubtitle: "हमारी जमुई सहायता टीम आपकी सेवा के लिए उपलब्ध है।",
    callUs: "कॉल करें: +91 62078 56200",
    waUs: "व्हाट्सएप करें: +91 62078 56200",
    supportHours: "रोज़ाना उपलब्ध: सुबह 8:00 – रात 10:00",
    close: "बंद करें",
    navOrder: "ऑर्डर",
    navTrack: "ट्रैक ऑर्डर",
    offlineNotice: "इंटरनेट नहीं है। आपका ऑर्डर अभी प्लेस नहीं हुआ है।",

    // Screen 1: New Order
    heroTag: "जमुई तेज़ डिलीवरी",
    heroHeading: "दवाइयां सीधे आपके घर तक",
    heroSubhead: "हर ऑर्डर पर मुफ्त डिलीवरी। पक्का बिल देखने के बाद ही भुगतान करें।",

    // Returning Customer Card
    returningBadge: "झटपट दोबारा ऑर्डर",
    returningPrompt: "स्वागत है, {name}। {address}, {landmark} के पास डिलीवर करें?",
    yesUseThis: "हाँ, यही पता चुनें",
    change: "बदलें",

    // Section 1
    sec1Title: "आपको क्या चाहिए?",
    tabType: "दवाइयों के नाम लिखें",
    tabUpload: "पर्ची (Prescription) अपलोड करें",
    medNamePlaceholder: "दवा का नाम (उदा. पैरासिटामोल)",
    medStrengthPlaceholder: "पावर / स्ट्रेंथ (उदा. 650mg, 15 गोली)",
    addAnotherMed: "+ अन्य दवा जोड़ें",
    brandNotesLabel: "कोई खास ब्रांड या निर्देश?",
    brandNotesPlaceholder: "उदा. कोई भी जेनरिक ब्रांड चलेगा, या बदलाव होने पर कॉल करें",
    uploadTitle: "पर्ची की फोटो खींचें या अपलोड करें",
    uploadCamera: "कैमरा",
    uploadGallery: "गैलरी",
    uploadPrivacy: "इसे केवल आप, आपके राइडर और Zupit देख सकते हैं।",
    uploadFailMsg: "अपलोड विफल रहा। पुनः प्रयास करें।",
    retryBtn: "दोबारा प्रयास करें",
    rxConsentLabel: "मैं इस ऑर्डर को पूरा करने के लिए Zupit द्वारा मेरी पर्ची के उपयोग पर सहमत हूँ।",
    rxConsentError: "कृपया इस ऑर्डर के लिए पर्ची उपयोग करने की सहमति दें।",

    // Section 2
    sec2Title: "डिलीवरी का पता",
    nameLabel: "पूरा नाम",
    namePlaceholder: "अपना पूरा नाम दर्ज करें",
    mobileLabel: "मोबाइल नंबर",
    mobilePlaceholder: "10 अंकों का मोबाइल नंबर",
    mobileHelper: "आपके राइडर इसी नंबर पर कॉल करेंगे।",
    addressLabel: "मकान/फ्लैट नंबर, गली या मोहल्ला",
    addressPlaceholder: "उदा. मकान 14, स्टेशन रोड",
    landmarkLabel: "लैंडमार्क (पहचान का स्थान)",
    landmarkPlaceholder: "उदा. गांधी चौक के पास",
    landmarkHelper: "राइडर को जल्दी पहुँचने में मदद मिलती है",
    pincodeLabel: "पिनकोड",
    pincodePlaceholder: "6 अंकों का पिनकोड (उदा. 811307)",
    pincodeValidMsg: "जमुई में डिलीवरी उपलब्ध (30-45 मिनट में डिलीवरी)",
    pincodeInvalidMsg: "हम अभी इस क्षेत्र में डिलीवरी नहीं करते हैं।",
    useLocationBtn: "मेरी वर्तमान लोकेशन का उपयोग करें",

    // Section 3
    sec3Title: "भुगतान",
    payCodTitle: "कैश ऑन डिलीवरी (नकद भुगतान)",
    payCodSub: "दवाइयां मिलने पर राइडर को घर पर नकद भुगतान करें",
    payOnlineTitle: "बिल देखने के बाद ऑनलाइन भुगतान",
    payOnlineSub: "राइडर द्वारा पक्का बिल अपलोड होने पर UPI (GPay/PhonePe) से भुगतान करें",
    paymentAssurance: "भुगतान करने से पहले आप पक्का बिल देखेंगे।",
    btnPlaceOrder: "ऑर्डर दें",

    // Validation Errors
    errName: "कृपया अपना पूरा नाम दर्ज करें",
    errMobile: "6 से 9 से शुरू होने वाला 10 अंकों का मान्य मोबाइल नंबर दर्ज करें",
    errAddress: "कृपया मकान या गली का पता दर्ज करें",
    errLandmark: "कृपया नजदीकी लैंडमार्क दर्ज करें",
    errPincode: "6 अंकों का पिनकोड दर्ज करें",
    errPincodeUnserviceable: "हम अभी इस क्षेत्र में डिलीवरी नहीं करते हैं।",
    errNoItems: "कम से कम एक दवा का नाम लिखें या पर्ची अपलोड करें।",

    // Screen 2: Order Placed
    placedSuccess: "ऑर्डर दर्ज हो गया है",
    placedConfirmMsg: "Zupit राइडर पुष्टि के लिए आपको जल्द ही कॉल करेंगे।",
    placedSmsMsg: "हमने ट्रैकिंग लिंक SMS द्वारा भी भेज दिया है।",
    btnTrackOrder: "ऑर्डर ट्रैक करें",
    btnCallUs: "कॉल करें",
    summaryMedicines: "दवाइयां",
    summaryPrescription: "पर्ची",
    summaryAddress: "डिलीवरी का पता",
    summaryPayment: "भुगतान विधि",

    // Screen 3: Track Order Entry
    trackEntryTitle: "ऑर्डर ट्रैक करें",
    trackEntrySub: "स्थिति देखने के लिए मोबाइल नंबर और ऑर्डर आईडी दर्ज करें",
    recentOrderCardTitle: "इस फोन पर हालिया ऑर्डर",
    trackMobileLabel: "मोबाइल नंबर",
    trackIdLabel: "ऑर्डर आईडी",
    btnTrackLookup: "ऑर्डर ट्रैक करें",
    trackErrorMsg: "हमें यह ऑर्डर नहीं मिला। कृपया नंबर जांचें और दोबारा प्रयास करें।",
    noActiveOrders: "इस फोन पर कोई हालिया ऑर्डर नहीं मिला।",
    btnPlaceNewOrder: "नया ऑर्डर दें",

    // Screen 4: Order Tracking
    statusStepPlaced: "ऑर्डर दर्ज हुआ",
    statusStepAssigned: "राइडर असाइन हुआ",
    statusStepBuying: "दवाइयां खरीदी जा रही हैं",
    statusStepTransit: "डिलीवरी के लिए निकला",
    statusStepDelivered: "डिलीवर हुआ",
    statusStepCancelled: "रद्द किया गया",
    
    riderAssignedTitle: "डिलीवरी राइडर",
    btnCallRider: "कॉल करें",
    btnWaRider: "व्हाट्सएप",

    billCardTitle: "दवा दुकान का बिल तैयार है",
    billAmountLabel: "भुगतान योग्य कुल बिल राशि",
    billPhotoTapText: "पक्का बिल देखने के लिए फोटो पर टैप करें",
    btnPayNow: "अभी भुगतान करें",
    payCodToRider: "राइडर को ₹{amount} नकद दें",

    deliveryCodeTitle: "राइडर को यह कोड बताएं",
    deliveryCodeHelper: "राइडर डिलीवरी के समय इस 4 अंकों के कोड की पुष्टि करेगा",
    updatedJustNow: "अभी अपडेट हुआ",

    trackNotFoundTitle: "ऑर्डर नहीं मिला",
    trackNotFoundMsg: "हमें यह ऑर्डर नहीं मिला। नंबर जांचें और पुनः प्रयास करें।",
    btnTrackAnother: "ऑर्डर ट्रैक करें",
    btnHome: "होम",

    orderDetailsTitle: "ऑर्डर का विवरण",
    cancelOrderLink: "ऑर्डर रद्द करें",
    confirmCancelTitle: "ऑर्डर रद्द करना चाहते हैं?",
    confirmCancelMsg: "क्या आप वाकई इस ऑर्डर को रद्द करना चाहते हैं? राइडर ने अभी दवाइयां नहीं खरीदी हैं।",
    keepOrderBtn: "ऑर्डर जारी रखें",
    yesCancelBtn: "हाँ, ऑर्डर रद्द करें",

    // Screen 5: Item Not Available
    unavailableTitle: "दवा दुकान पर उपलब्ध नहीं है",
    unavailableNotice: "दवा की दुकान पर एक दवा उपलब्ध नहीं थी।",
    unavailableChoiceSkip: "दवा छोड़ें",
    unavailableChoiceCall: "मुझे कॉल करें",
    unavailableChoiceCancel: "ऑर्डर रद्द करें",
    btnSkipItem: "दवा छोड़ें",
    btnCallMe: "मुझे कॉल करें",
    btnCancelOrder: "ऑर्डर रद्द करें",

    // Screen 6: Payment
    paymentHeaderTitle: "दवा बिल का भुगतान",
    billTotalLabel: "दवा का कुल बिल",
    deliveryFeeLabel: "डिलीवरी शुल्क",
    freeDelivery: "₹ 0 (मुफ्त)",
    totalPayableLabel: "कुल देय राशि",
    upiOptionsTitle: "UPI या भुगतान का माध्यम चुनें",
    otherUpiLabel: "अन्य UPI आईडी",
    cardLabel: "डेबिट / क्रेडिट कार्ड",
    btnPayAmount: "₹ {amount} का भुगतान करें",
    paymentProcessing: "पेमेंट गेटवे से संपर्क हो रहा है...",
    paymentSuccessTitle: "भुगतान सफल रहा!",
    paymentSuccessMsg: "₹ {amount} का भुगतान सफल रहा। रसीद SMS द्वारा भेजी गई।",
    btnBackToTracking: "ट्रैकिंग पर वापस जाएं",
    paymentFailTitle: "भुगतान विफल रहा",
    paymentFailMsg: "बैंक सर्वर से प्रतिक्रिया नहीं मिली। कोई पैसा नहीं कटा।",
    btnTryAgain: "दोबारा प्रयास करें",
    btnPayCashInstead: "नकद भुगतान चुनें",

    // Screen 7: Delivered
    deliveredTitle: "दवाइयां डिलीवर हो चुकी हैं",
    deliveredSubtitle: "Zupit जमुई पर भरोसा करने के लिए धन्यवाद!",
    deliveredSummaryPaid: "कुल भुगतान किया गया बिल:",
    rateExperience: "डिलीवरी अनुभव को रेटिंग दें",
    feedbackPlaceholder: "राइडर या सेवा के बारे में कोई सुझाव? (वैकल्पिक)",
    btnDone: "हो गया",
    btnOrderAgain: "फिर से ऑर्डर करें"
  }
};

// Storage Key
const CUSTOMER_STORAGE_KEY = 'zupit.customer';

// Global App State
const AppState = {
  lang: 'en',
  currentScreen: 1, // 1: New Order, 2: Placed, 3: Track Entry, 4: Tracking, 5: Item Unavailable, 6: Payment, 7: Delivered
  trackingState: 'placed', // 'placed' | 'assigned' | 'buying' | 'bill_online' | 'bill_cash' | 'out_for_delivery' | 'delivered' | 'cancelled'
  
  // Section 1 State
  inputMode: 'type', // 'type' | 'upload' | 'both'
  medicines: [
    { name: "Paracetamol 650mg (Dolo)", strength: "Strip of 15 tabs", qty: 1 }
  ],
  brandNotes: "",
  prescriptions: [],
  prescriptionImages: [],
  simulateUploadFail: false,
  
  // Section 2 & 3 State
  fullName: "",
  mobileNumber: "",
  address: "",
  landmark: "",
  pincode: "",
  paymentMethod: "cod", // 'cod' | 'online'
  paymentsEnabled: false,
  codEnabled: true,
  
  // Active Order Model
  activeOrder: {
    orderId: "ZP-10482",
    createdAt: "10:14 AM",
    riderName: "Sunil Kumar",
    riderInitials: "SK",
    riderVehicle: "BR-46-A-1284",
    riderRating: "4.9 ★",
    riderPhone: "+916207856200",
    billAmount: 486,
    deliveryCode: "4 8 2 9",
    pharmacyName: "Jan Aushadhi Kendra, Station Road, Jamui",
    paymentChosen: "cod",
    paymentPaid: false,
    itemAlertDismissed: false,
    trackingToken: "",
    timestamps: {
      placed: "10:14 AM",
      assigned: "10:18 AM",
      buying: "10:24 AM",
      out_for_delivery: "10:35 AM",
      delivered: "10:48 AM"
    }
  },

  // Serviceable Jamui Pincodes (811307 is active in DB)
  serviceablePincodes: ['811307'],
  
  // Returning customer seed in localStorage
  returningCustomer: {
    name: "Sunita",
    phone: "9835123456",
    address: "Station Road",
    landmark: "near Gandhi Chowk",
    pincode: "811307",
    payment: "cod"
  },
  
  isOffline: false,
  starsRating: 5
};

// Realistic mock SVG assets for Bill Photo & Prescriptions (Render instantly offline without external network)
const ASSETS = {
  billThumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><rect width="300" height="420" fill="%23FFFFFF" stroke="%23CBD5E1" stroke-width="2"/><rect x="15" y="15" width="270" height="55" fill="%23EEF4FF" rx="6"/><text x="150" y="38" font-family="Arial" font-size="14" font-weight="bold" fill="%231D3F8F" text-anchor="middle">JAN AUSHADHI KENDRA</text><text x="150" y="55" font-family="Arial" font-size="13" fill="%235B6573" text-anchor="middle">Station Road, Jamui • Lic %23 BR-JM-8921</text><line x1="20" y1="80" x2="280" y2="80" stroke="%23E2E8F0" stroke-width="1.5"/><text x="20" y="98" font-family="Arial" font-size="13" fill="%2314181F">Date: 12-Oct-2026</text><text x="280" y="98" font-family="Arial" font-size="13" fill="%2314181F" text-anchor="end">Bill: %23 ZP-B-9481</text><rect x="15" y="112" width="270" height="24" fill="%23F8FAFC"/><text x="25" y="128" font-family="Arial" font-size="13" font-weight="bold" fill="%23475569">Item / Qty</text><text x="275" y="128" font-family="Arial" font-size="13" font-weight="bold" fill="%23475569" text-anchor="end">Amount</text><text x="25" y="154" font-family="Arial" font-size="13" fill="%2314181F">1. Paracetamol 650mg (1x15)</text><text x="275" y="154" font-family="Arial" font-size="13" font-weight="600" fill="%2314181F" text-anchor="end">₹ 32.00</text><text x="25" y="178" font-family="Arial" font-size="13" fill="%2314181F">2. Pantoprazole 40mg (1x10)</text><text x="275" y="178" font-family="Arial" font-size="13" font-weight="600" fill="%2314181F" text-anchor="end">₹ 128.00</text><text x="25" y="202" font-family="Arial" font-size="13" fill="%2314181F">3. Azithromycin 500mg (1x3)</text><text x="275" y="202" font-family="Arial" font-size="13" font-weight="600" fill="%2314181F" text-anchor="end">₹ 114.00</text><text x="25" y="226" font-family="Arial" font-size="13" fill="%2314181F">4. Amox-Clav 625mg (1x6)</text><text x="275" y="226" font-family="Arial" font-size="13" font-weight="600" fill="%2314181F" text-anchor="end">₹ 162.00</text><text x="25" y="250" font-family="Arial" font-size="13" fill="%2314181F">5. ORS Electral (2 pkts)</text><text x="275" y="250" font-family="Arial" font-size="13" font-weight="600" fill="%2314181F" text-anchor="end">₹ 50.00</text><line x1="20" y1="270" x2="280" y2="270" stroke="%23E2E8F0" stroke-width="1.5"/><text x="25" y="292" font-family="Arial" font-size="13" fill="%235B6573">Subtotal</text><text x="275" y="292" font-family="Arial" font-size="13" fill="%2314181F" text-anchor="end">₹ 486.00</text><text x="25" y="312" font-family="Arial" font-size="13" fill="%231E8E5A" font-weight="bold">Zupit Delivery Fee</text><text x="275" y="312" font-family="Arial" font-size="13" fill="%231E8E5A" font-weight="bold" text-anchor="end">FREE</text><rect x="15" y="328" width="270" height="42" fill="%231D3F8F" rx="6"/><text x="30" y="354" font-family="Arial" font-size="14" font-weight="bold" fill="%23FFFFFF">TOTAL BILL</text><text x="270" y="356" font-family="Arial" font-size="18" font-weight="bold" fill="%23FFFFFF" text-anchor="end">₹ 486.00</text><text x="150" y="395" font-family="Arial" font-size="13" fill="%2364748B" text-anchor="middle">Verified by Chemist: R. Kumar (Jamui)</text></svg>`,
  
  prescriptionMock: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300"><rect width="240" height="300" fill="%23F8FAFC" stroke="%2394A3B8" stroke-width="1.5"/><rect x="10" y="10" width="220" height="40" fill="%23E2E8F0" rx="4"/><text x="120" y="26" font-family="Arial" font-size="13" font-weight="bold" fill="%231E293B" text-anchor="middle">DR. A. K. VERMA, MD</text><text x="120" y="40" font-family="Arial" font-size="13" fill="%2364748B" text-anchor="middle">Reg %23 41892 • Sadar Hospital Road, Jamui</text><text x="16" y="70" font-family="Arial" font-size="15" font-weight="bold" fill="%231D3F8F">Rx</text><line x1="16" y1="90" x2="224" y2="90" stroke="%23CBD5E1"/><text x="20" y="112" font-family="Arial" font-size="13" fill="%23334155">1. Tab Pantop 40mg (1-0-0)</text><text x="20" y="136" font-family="Arial" font-size="13" fill="%23334155">2. Tab Dolo 650mg SOS</text><text x="20" y="160" font-family="Arial" font-size="13" fill="%23334155">3. Tab Azee 500mg (1 OD x 3d)</text><rect x="150" y="230" width="70" height="30" fill="%23E2E8F0" rx="4"/><text x="185" y="250" font-family="Arial" font-size="13" fill="%2364748B" text-anchor="middle">Doctor Seal</text></svg>`
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  bindGlobalEvents();
  applyPaymentConfig();
  fetchPublicConfig();
  handleRoute();
  applyLanguage(AppState.lang);
});

async function fetchPublicConfig() {
  try {
    const res = await fetch('/api/v1/public/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.config) {
        AppState.paymentsEnabled = !!data.config.payments_enabled;
        AppState.codEnabled = data.config.cod_enabled !== false;
      }
    }
  } catch (err) {
    console.warn("Config load error", err);
  } finally {
    applyPaymentConfig();
  }
}

function applyPaymentConfig() {
  const onlineCard = document.getElementById('pay-card-online');
  const codCard = document.getElementById('pay-card-cod');
  if (!AppState.paymentsEnabled) {
    if (onlineCard) onlineCard.style.display = 'none';
    if (codCard) {
      codCard.style.display = 'flex';
      selectPaymentMethod('cod');
    }
  } else {
    if (onlineCard) onlineCard.style.display = 'flex';
  }
}

// Seed & sync storage
function initStorage() {
  const storedUser = localStorage.getItem(CUSTOMER_STORAGE_KEY);
  if (!storedUser) {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(AppState.returningCustomer));
  } else {
    try {
      AppState.returningCustomer = JSON.parse(storedUser);
    } catch (e) {
      console.warn("Storage parse error", e);
    }
  }

  // Load recent order if stored
  const recentOrderRaw = localStorage.getItem('zupit.recent_order');
  if (recentOrderRaw) {
    try {
      const recent = JSON.parse(recentOrderRaw);
      if (recent && (recent.orderNumber || recent.orderId)) {
        AppState.activeOrder.orderId = recent.orderNumber || recent.orderId;
        AppState.activeOrder.orderNumber = recent.orderNumber || recent.orderId;
        AppState.activeOrder.trackingToken = recent.trackingToken || "";
        if (recent.phone) AppState.activeOrder.deliveryPhone = recent.phone;
        if (recent.address) AppState.activeOrder.deliveryAddress = recent.address;
      }
    } catch (e) {
      console.warn("Recent order parse error", e);
    }
  }
}

// Global Event Listeners
function bindGlobalEvents() {
  // Brand Click -> Screen 1
  document.getElementById('brand-logo-trigger').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    navigateToScreen(1);
  });

  // Language Switch
  document.getElementById('lang-toggle-btn').addEventListener('click', toggleLanguage);

  // Help Sheet Triggers
  document.getElementById('help-top-btn').addEventListener('click', () => toggleHelpSheet(true));
  document.getElementById('close-help-sheet-btn').addEventListener('click', () => toggleHelpSheet(false));
  document.getElementById('help-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'help-modal-overlay') toggleHelpSheet(false);
  });

  // Bottom Navigation Bar
  document.getElementById('nav-order-btn').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    navigateToScreen(1);
  });
  document.getElementById('nav-track-btn').addEventListener('click', () => {
    window.history.pushState({}, '', '/track');
    navigateToScreen(3);
  });

  // Segmented Mode Control (Screen 1)
  document.getElementById('seg-type-btn').addEventListener('click', () => switchInputMode('type'));
  document.getElementById('seg-upload-btn').addEventListener('click', () => switchInputMode('upload'));

  // Add Medicine Row
  document.getElementById('add-medicine-btn').addEventListener('click', addMedicineRow);

  // Upload Buttons & File Inputs
  const cameraInput = document.getElementById('file-camera-input');
  const galleryInput = document.getElementById('file-gallery-input');

  document.getElementById('btn-upload-camera').addEventListener('click', () => {
    if (cameraInput) cameraInput.click();
  });
  document.getElementById('btn-upload-gallery').addEventListener('click', () => {
    if (galleryInput) galleryInput.click();
  });

  if (cameraInput) cameraInput.addEventListener('change', handleFileInputChange);
  if (galleryInput) galleryInput.addEventListener('change', handleFileInputChange);
  document.getElementById('btn-upload-retry').addEventListener('click', retryUpload);

  // Current Location Button
  document.getElementById('use-current-location-btn').addEventListener('click', useCurrentLocation);

  // Pincode Input Live Serviceable Check
  const pinInput = document.getElementById('field-pincode');
  pinInput.addEventListener('input', handlePincodeInput);

  // Payment Radio Cards (Screen 1)
  document.getElementById('pay-card-cod').addEventListener('click', () => selectPaymentMethod('cod'));
  document.getElementById('pay-card-online').addEventListener('click', () => selectPaymentMethod('online'));

  // Place Order Submit
  document.getElementById('place-order-submit-btn').addEventListener('click', handlePlaceOrder);

  // Returning Customer Quick Card Buttons
  document.getElementById('btn-returning-yes').addEventListener('click', applyReturningCustomerData);
  document.getElementById('btn-returning-change').addEventListener('click', dismissReturningCustomerCard);

  // History Popstate Handling
  window.addEventListener('popstate', handleRoute);

  // Online / Offline Listeners
  window.addEventListener('online', () => {
    AppState.isOffline = false;
    document.getElementById('offline-alert-banner').classList.add('hidden');
  });
  window.addEventListener('offline', () => {
    AppState.isOffline = true;
    document.getElementById('offline-alert-banner').classList.remove('hidden');
  });

  // Screen 2 Buttons
  document.getElementById('btn-track-placed-order').addEventListener('click', () => {
    const token = AppState.activeOrder.trackingToken;
    if (token) {
      window.history.pushState({}, '', `/track/${token}`);
      navigateToScreen(4);
      fetchTrackingData(token);
    } else {
      window.history.pushState({}, '', '/track');
      navigateToScreen(3);
    }
  });
  document.getElementById('btn-placed-call-us').addEventListener('click', () => {
    window.location.href = "tel:+916207856200";
  });

  // Screen 3 Lookup Form
  document.getElementById('btn-track-lookup-submit').addEventListener('click', handleTrackLookup);
  document.getElementById('recent-order-tappable-card').addEventListener('click', () => {
    const token = AppState.activeOrder.trackingToken;
    if (token) {
      window.history.pushState({}, '', `/track/${token}`);
      navigateToScreen(4);
      fetchTrackingData(token);
    } else {
      if (AppState.activeOrder.orderId) {
        document.getElementById('field-track-id').value = AppState.activeOrder.orderId;
      }
      if (AppState.activeOrder.deliveryPhone || AppState.mobileNumber) {
        document.getElementById('field-track-mobile').value = (AppState.activeOrder.deliveryPhone || AppState.mobileNumber).slice(-10);
      }
    }
  });
  document.getElementById('btn-empty-place-order').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    navigateToScreen(1);
  });

  // Not Found Container Buttons
  const notFoundTrackBtn = document.getElementById('btn-notfound-track-again');
  if (notFoundTrackBtn) {
    notFoundTrackBtn.addEventListener('click', () => {
      window.history.pushState({}, '', '/track');
      navigateToScreen(3);
    });
  }
  const notFoundHomeBtn = document.getElementById('btn-notfound-home');
  if (notFoundHomeBtn) {
    notFoundHomeBtn.addEventListener('click', () => {
      window.history.pushState({}, '', '/');
      navigateToScreen(1);
    });
  }

  // Screen 4 Accordion Toggle
  document.getElementById('order-accordion-trigger').addEventListener('click', toggleOrderAccordion);

  // Screen 4 Bill Lightbox Triggers
  document.getElementById('bill-photo-preview-box').addEventListener('click', () => toggleBillLightbox(true));
  document.getElementById('close-lightbox-btn').addEventListener('click', () => toggleBillLightbox(false));
  document.getElementById('bill-lightbox-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'bill-lightbox-overlay') toggleBillLightbox(false);
  });

  // Screen 4 Pay Now Button (Direct to Screen 6)
  document.getElementById('btn-bill-pay-now').addEventListener('click', () => navigateToScreen(6));

  // Screen 4 Cancel Order Triggers
  document.getElementById('cancel-order-link-btn').addEventListener('click', () => toggleCancelModal(true));
  document.getElementById('btn-keep-order').addEventListener('click', () => toggleCancelModal(false));
  document.getElementById('btn-confirm-cancel').addEventListener('click', confirmOrderCancellation);
  document.getElementById('cancel-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'cancel-modal-overlay') toggleCancelModal(false);
  });

  // Screen 4 Item Unavailable Alert Action Buttons
  const skipBtn = document.getElementById('btn-track-skip-item');
  if (skipBtn) skipBtn.addEventListener('click', () => handleItemDecision('skip'));
  const callBtn = document.getElementById('btn-track-call-me');
  if (callBtn) callBtn.addEventListener('click', () => handleItemDecision('call_me'));
  const cancelUnavailBtn = document.getElementById('btn-track-cancel-order');
  if (cancelUnavailBtn) cancelUnavailBtn.addEventListener('click', () => handleItemDecision('cancel'));

  // Screen 5 Choices (Item Unavailable standalone view)
  document.getElementById('choice-skip-item').addEventListener('click', () => handleItemDecision('skip'));
  document.getElementById('choice-call-me').addEventListener('click', () => handleItemDecision('call_me'));
  document.getElementById('choice-cancel-unavailable').addEventListener('click', () => handleItemDecision('cancel'));

  // Screen 6 Payment Screen Actions
  document.getElementById('btn-back-from-payment').addEventListener('click', () => navigateToScreen(4));
  document.getElementById('btn-execute-payment').addEventListener('click', executePaymentSimulation);
  document.getElementById('btn-payment-success-done').addEventListener('click', () => {
    AppState.activeOrder.paymentPaid = true;
    AppState.trackingState = 'out_for_delivery';
    navigateToScreen(4);
  });
  document.getElementById('btn-payment-retry').addEventListener('click', () => {
    document.getElementById('payment-fail-card').style.display = 'none';
    document.getElementById('btn-execute-payment').style.display = 'flex';
  });
  document.getElementById('btn-payment-pay-cash').addEventListener('click', () => {
    AppState.activeOrder.paymentChosen = 'cod';
    AppState.trackingState = 'bill_cash';
    navigateToScreen(4);
  });

  // Screen 6 UPI Brand Options selection
  document.querySelectorAll('.upi-brand-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.upi-brand-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });
  });

  // Screen 7 Rating & Action Buttons
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const star = parseInt(btn.dataset.star, 10);
      setStarRating(star);
    });
  });
  document.getElementById('btn-delivered-done').addEventListener('click', submitDeliveredRating);
  document.getElementById('btn-delivered-reorder').addEventListener('click', handleOrderAgain);

  // Tab Visibility Auto-Pause Polling
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopPolling();
    } else {
      if (AppState.currentScreen === 4 && AppState.activeOrder.trackingToken) {
        fetchTrackingData(AppState.activeOrder.trackingToken, true);
        startPolling(AppState.activeOrder.trackingToken);
      }
    }
  });

  // Demo Toolbar Listeners
  document.getElementById('demo-toggle-offline').addEventListener('click', toggleOfflineBanner);
  document.getElementById('demo-toggle-upload-error').addEventListener('click', toggleUploadErrorSimulation);
  document.getElementById('demo-toggle-returning').addEventListener('click', toggleReturningCustomerSeed);
  document.getElementById('demo-trigger-unavailable').addEventListener('click', () => navigateToScreen(5));
  document.getElementById('demo-next-state-btn').addEventListener('click', advanceToNextState);
  
  document.querySelectorAll('.demo-frame-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetState = btn.dataset.state;
      setTrackingFrameState(targetState);
    });
  });

  // Offline banner close button
  document.getElementById('offline-close-btn').addEventListener('click', () => {
    AppState.isOffline = false;
    document.getElementById('offline-alert-banner').classList.add('hidden');
  });
}

// Navigation Router
function navigateToScreen(screenNum) {
  AppState.currentScreen = screenNum;

  // Toggle screens
  document.querySelectorAll('.screen-view').forEach(view => {
    view.classList.remove('active');
  });
  
  const targetView = document.getElementById(`screen-${screenNum}-view`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update bottom navigation bar
  const navOrder = document.getElementById('nav-order-btn');
  const navTrack = document.getElementById('nav-track-btn');
  if (screenNum === 1) {
    navOrder.classList.add('active');
    navTrack.classList.remove('active');
  } else if (screenNum === 3 || screenNum === 4 || screenNum === 5 || screenNum === 6 || screenNum === 7) {
    navTrack.classList.add('active');
    navOrder.classList.remove('active');
  } else {
    navOrder.classList.remove('active');
    navTrack.classList.remove('active');
  }

  // Scroll mobile frame to top
  const scrollContainer = document.getElementById('app-scroll-canvas');
  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
  }

  // Screen specific hooks
  if (screenNum === 1) {
    renderReturningCustomerCard();
    renderMedicineRows();
  } else if (screenNum === 2) {
    renderOrderPlacedSummary();
  } else if (screenNum === 3) {
    renderTrackLookupView();
  } else if (screenNum === 4) {
    renderTrackingScreen();
  } else if (screenNum === 6) {
    renderPaymentScreen();
  } else if (screenNum === 7) {
    renderDeliveredScreen();
  }

  // Update demo status tag
  updateDemoToolbarStatus();
}

// Language Controller
function toggleLanguage() {
  AppState.lang = AppState.lang === 'en' ? 'hi' : 'en';
  applyLanguage(AppState.lang);
}

function applyLanguage(lang) {
  const dict = I18N[lang];
  document.documentElement.lang = lang;

  // Header and Navigation
  document.getElementById('lang-toggle-text').textContent = dict.langToggle;
  document.getElementById('nav-order-label').textContent = dict.navOrder;
  document.getElementById('nav-track-label').textContent = dict.navTrack;
  document.getElementById('offline-banner-text').textContent = dict.offlineNotice;

  // Help Sheet
  document.getElementById('help-sheet-title').textContent = dict.supportTitle;
  document.getElementById('help-sheet-sub').textContent = dict.supportSubtitle;
  document.getElementById('help-sheet-call-label').textContent = dict.callUs;
  document.getElementById('help-sheet-wa-label').textContent = dict.waUs;
  document.getElementById('help-sheet-hours').textContent = dict.supportHours;

  // Screen 1: New Order
  document.getElementById('hero-tag-text').textContent = dict.heroTag;
  document.getElementById('hero-heading-text').textContent = dict.heroHeading;
  document.getElementById('hero-subhead-text').textContent = dict.heroSubhead;

  document.getElementById('sec1-title-text').textContent = dict.sec1Title;
  document.getElementById('tab-type-label').textContent = dict.tabType;
  document.getElementById('tab-upload-label').textContent = dict.tabUpload;
  document.getElementById('add-medicine-label').textContent = dict.addAnotherMed;
  document.getElementById('notes-field-label').textContent = dict.brandNotesLabel;
  document.getElementById('field-brand-notes').placeholder = dict.brandNotesPlaceholder;

  document.getElementById('upload-box-title').textContent = dict.uploadTitle;
  document.getElementById('upload-camera-label').textContent = dict.uploadCamera;
  document.getElementById('upload-gallery-label').textContent = dict.uploadGallery;
  document.getElementById('upload-privacy-text').textContent = dict.uploadPrivacy;
  document.getElementById('upload-error-text').textContent = dict.uploadFailMsg;
  document.getElementById('btn-upload-retry').textContent = dict.retryBtn;
  const rxConsentLabelEl = document.getElementById('rx-consent-label-text');
  if (rxConsentLabelEl) rxConsentLabelEl.textContent = dict.rxConsentLabel;

  document.getElementById('sec2-title-text').textContent = dict.sec2Title;
  document.getElementById('label-full-name').textContent = dict.nameLabel;
  document.getElementById('field-full-name').placeholder = dict.namePlaceholder;
  document.getElementById('label-mobile').textContent = dict.mobileLabel;
  document.getElementById('field-mobile').placeholder = dict.mobilePlaceholder;
  document.getElementById('mobile-helper-text').textContent = dict.mobileHelper;
  document.getElementById('label-address').textContent = dict.addressLabel;
  document.getElementById('field-address').placeholder = dict.addressPlaceholder;
  document.getElementById('label-landmark').textContent = dict.landmarkLabel;
  document.getElementById('field-landmark').placeholder = dict.landmarkPlaceholder;
  document.getElementById('landmark-helper-text').textContent = dict.landmarkHelper;
  document.getElementById('label-pincode').textContent = dict.pincodeLabel;
  document.getElementById('field-pincode').placeholder = dict.pincodePlaceholder;
  document.getElementById('use-current-location-text').textContent = dict.useLocationBtn;

  document.getElementById('sec3-title-text').textContent = dict.sec3Title;
  document.getElementById('pay-cod-title').textContent = dict.payCodTitle;
  document.getElementById('pay-cod-sub').textContent = dict.payCodSub;
  document.getElementById('pay-online-title').textContent = dict.payOnlineTitle;
  document.getElementById('pay-online-sub').textContent = dict.payOnlineSub;
  document.getElementById('payment-assurance-text').textContent = dict.paymentAssurance;
  document.getElementById('place-order-btn-text').textContent = dict.btnPlaceOrder;

  // Returning Customer card prompt
  renderReturningCustomerCard();

  // Screen 2: Placed
  document.getElementById('placed-success-title').textContent = dict.placedSuccess;
  document.getElementById('placed-confirm-line').textContent = dict.placedConfirmMsg;
  document.getElementById('placed-sms-line').textContent = dict.placedSmsMsg;
  document.getElementById('track-placed-btn-text').textContent = dict.btnTrackOrder;
  document.getElementById('placed-call-us-text').textContent = dict.btnCallUs;

  // Screen 3: Track Entry
  document.getElementById('track-entry-title').textContent = dict.trackEntryTitle;
  document.getElementById('track-entry-sub').textContent = dict.trackEntrySub;
  document.getElementById('recent-order-badge-text').textContent = dict.recentOrderCardTitle;
  document.getElementById('label-track-mobile').textContent = dict.trackMobileLabel;
  document.getElementById('field-track-mobile').placeholder = dict.mobilePlaceholder;
  document.getElementById('label-track-id').textContent = dict.trackIdLabel;
  document.getElementById('track-lookup-btn-text').textContent = dict.btnTrackLookup;
  document.getElementById('track-error-text').textContent = dict.trackErrorMsg;
  document.getElementById('empty-orders-text').textContent = dict.noActiveOrders;
  document.getElementById('empty-place-btn-text').textContent = dict.btnPlaceNewOrder;

  // Screen 4: Tracking & Not Found
  const notFoundTitleEl = document.getElementById('not-found-title');
  if (notFoundTitleEl) notFoundTitleEl.textContent = dict.trackNotFoundTitle;
  const notFoundMsgEl = document.getElementById('not-found-msg');
  if (notFoundMsgEl) notFoundMsgEl.textContent = dict.trackNotFoundMsg;
  const notFoundTrackEl = document.getElementById('notfound-track-text');
  if (notFoundTrackEl) notFoundTrackEl.textContent = dict.btnTrackAnother;
  const notFoundHomeEl = document.getElementById('notfound-home-text');
  if (notFoundHomeEl) notFoundHomeEl.textContent = dict.btnHome;

  const pollStatusEl = document.getElementById('tracking-poll-status-text');
  if (pollStatusEl) pollStatusEl.textContent = dict.updatedJustNow;

  const trackHeaderLabel = document.getElementById('tracking-header-label');
  if (trackHeaderLabel) trackHeaderLabel.textContent = lang === 'en' ? "Tracking Order" : "ऑर्डर ट्रैकिंग";

  const trackUnavailTitle = document.getElementById('track-unavailable-title');
  if (trackUnavailTitle) trackUnavailTitle.textContent = dict.unavailableTitle;
  const trackSkipBtn = document.getElementById('track-skip-btn-text');
  if (trackSkipBtn) trackSkipBtn.textContent = dict.btnSkipItem;
  const trackCallBtn = document.getElementById('track-call-btn-text');
  if (trackCallBtn) trackCallBtn.textContent = dict.btnCallMe;
  const trackCancelBtn = document.getElementById('track-cancel-btn-text');
  if (trackCancelBtn) trackCancelBtn.textContent = dict.btnCancelOrder;

  document.getElementById('rider-card-title').textContent = dict.riderAssignedTitle;
  document.getElementById('call-rider-text').textContent = dict.btnCallRider;
  document.getElementById('wa-rider-text').textContent = dict.btnWaRider;
  document.getElementById('bill-card-title').textContent = dict.billCardTitle;
  document.getElementById('bill-amount-label').textContent = dict.billAmountLabel;
  document.getElementById('bill-photo-tap-label').textContent = dict.billPhotoTapText;
  document.getElementById('bill-pay-btn-text').textContent = dict.btnPayNow;
  document.getElementById('delivery-code-title').textContent = dict.deliveryCodeTitle;
  document.getElementById('delivery-code-helper').textContent = dict.deliveryCodeHelper;
  document.getElementById('order-accordion-title').textContent = dict.orderDetailsTitle;
  document.getElementById('cancel-order-link-btn').textContent = dict.cancelOrderLink;
  document.getElementById('confirm-cancel-title').textContent = dict.confirmCancelTitle;
  document.getElementById('confirm-cancel-msg').textContent = dict.confirmCancelMsg;
  document.getElementById('keep-order-btn-text').textContent = dict.keepOrderBtn;
  document.getElementById('yes-cancel-btn-text').textContent = dict.yesCancelBtn;

  // Screen 5: Item Unavailable
  document.getElementById('item-unavailable-title').textContent = dict.unavailableTitle;
  document.getElementById('item-unavailable-notice').textContent = dict.unavailableNotice;
  document.getElementById('choice-skip-text').textContent = dict.unavailableChoiceSkip;
  document.getElementById('choice-call-text').textContent = dict.unavailableChoiceCall;
  document.getElementById('choice-cancel-text').textContent = dict.unavailableChoiceCancel;

  // Screen 6: Payment
  document.getElementById('payment-screen-title').textContent = dict.paymentHeaderTitle;
  document.getElementById('pay-label-bill-total').textContent = dict.billTotalLabel;
  document.getElementById('pay-label-delivery').textContent = dict.deliveryFeeLabel;
  document.getElementById('pay-val-delivery').textContent = dict.freeDelivery;
  document.getElementById('pay-label-payable').textContent = dict.totalPayableLabel;
  document.getElementById('pay-upi-title').textContent = dict.upiOptionsTitle;
  document.getElementById('pay-other-upi-label').textContent = dict.otherUpiLabel;
  document.getElementById('pay-card-label').textContent = dict.cardLabel;
  document.getElementById('pay-execute-btn-text').textContent = dict.btnPayAmount.replace('{amount}', AppState.activeOrder.billAmount);
  document.getElementById('pay-success-title').textContent = dict.paymentSuccessTitle;
  document.getElementById('pay-success-msg').textContent = dict.paymentSuccessMsg.replace('{amount}', AppState.activeOrder.billAmount);
  document.getElementById('pay-success-back-text').textContent = dict.btnBackToTracking;
  document.getElementById('pay-fail-title').textContent = dict.paymentFailTitle;
  document.getElementById('pay-fail-msg').textContent = dict.paymentFailMsg;
  document.getElementById('pay-retry-text').textContent = dict.btnTryAgain;
  document.getElementById('pay-cash-instead-text').textContent = dict.btnPayCashInstead;

  // Screen 7: Delivered
  document.getElementById('delivered-title').textContent = dict.deliveredTitle;
  document.getElementById('delivered-sub').textContent = dict.deliveredSubtitle;
  document.getElementById('delivered-summary-paid-label').textContent = dict.deliveredSummaryPaid;
  document.getElementById('delivered-rate-title').textContent = dict.rateExperience;
  document.getElementById('feedback-textarea').placeholder = dict.feedbackPlaceholder;
  document.getElementById('delivered-done-text').textContent = dict.btnDone;
  document.getElementById('delivered-reorder-text').textContent = dict.btnOrderAgain;

  // Rerender stepper and dynamic items
  if (AppState.currentScreen === 4) {
    renderTrackingScreen();
  }
}

// Screen 1: Returning Customer Card Logic
function renderReturningCustomerCard() {
  const card = document.getElementById('returning-customer-card');
  const storedUser = AppState.returningCustomer;
  const dict = I18N[AppState.lang];

  if (storedUser && storedUser.name) {
    card.style.display = 'flex';
    const promptText = dict.returningPrompt
      .replace('{name}', `<strong>${storedUser.name}</strong>`)
      .replace('{address}', storedUser.address)
      .replace('{landmark}', storedUser.landmark);
    document.getElementById('returning-customer-prompt').innerHTML = promptText;
  } else {
    card.style.display = 'none';
  }
}

function applyReturningCustomerData() {
  const user = AppState.returningCustomer;
  if (!user) return;

  document.getElementById('field-full-name').value = user.name;
  document.getElementById('field-mobile').value = user.phone;
  document.getElementById('field-address').value = user.address;
  document.getElementById('field-landmark').value = user.landmark;
  document.getElementById('field-pincode').value = user.pincode;
  
  handlePincodeInput();
  if (!AppState.paymentsEnabled || user.payment !== 'online') {
    selectPaymentMethod('cod');
  } else {
    selectPaymentMethod('online');
  }

  // Dismiss card with subtle feedback
  document.getElementById('returning-customer-card').style.display = 'none';
  showToast(AppState.lang === 'en' ? "Details loaded for Sunita" : "सुनीता का पता लोड हो गया");
}

function dismissReturningCustomerCard() {
  document.getElementById('returning-customer-card').style.display = 'none';
}

// Screen 1: Segmented Input Mode (Type vs Upload)
function switchInputMode(mode) {
  AppState.inputMode = mode;
  const typeBtn = document.getElementById('seg-type-btn');
  const uploadBtn = document.getElementById('seg-upload-btn');
  const typeContainer = document.getElementById('type-medicines-container');
  const uploadContainer = document.getElementById('upload-prescriptions-container');

  if (mode === 'type') {
    typeBtn.classList.add('active');
    uploadBtn.classList.remove('active');
    typeContainer.style.display = 'flex';
    uploadContainer.style.display = 'none';
  } else {
    uploadBtn.classList.add('active');
    typeBtn.classList.remove('active');
    typeContainer.style.display = 'none';
    uploadContainer.style.display = 'flex';
  }
}

// Medicine Rows Management
function renderMedicineRows() {
  const container = document.getElementById('medicine-rows-list');
  container.innerHTML = '';
  const dict = I18N[AppState.lang];

  AppState.medicines.forEach((med, index) => {
    const row = document.createElement('div');
    row.className = 'medicine-row';
    row.innerHTML = `
      <div class="medicine-row-header">
        <input type="text" class="med-input-name" placeholder="${dict.medNamePlaceholder}" value="${med.name}" data-index="${index}" aria-label="Medicine name">
        ${AppState.medicines.length > 1 ? `
          <button type="button" class="med-delete-btn" data-index="${index}" aria-label="Remove item" title="Remove">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        ` : ''}
      </div>
      <div class="medicine-row-body">
        <input type="text" class="med-input-strength" placeholder="${dict.medStrengthPlaceholder}" value="${med.strength}" data-index="${index}" aria-label="Medicine strength">
        <div class="stepper-wrap">
          <button type="button" class="stepper-btn med-stepper-dec" data-index="${index}" aria-label="Decrease quantity">−</button>
          <span class="stepper-val">${med.qty}</span>
          <button type="button" class="stepper-btn med-stepper-inc" data-index="${index}" aria-label="Increase quantity">+</button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // Bind dynamic inputs
  container.querySelectorAll('.med-input-name').forEach(input => {
    input.addEventListener('input', (e) => {
      AppState.medicines[e.target.dataset.index].name = e.target.value;
      const itemsErr = document.getElementById('items-error-msg');
      if (itemsErr) itemsErr.classList.remove('visible');
    });
  });

  container.querySelectorAll('.med-input-strength').forEach(input => {
    input.addEventListener('input', (e) => {
      AppState.medicines[e.target.dataset.index].strength = e.target.value;
    });
  });

  container.querySelectorAll('.med-stepper-dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.dataset.index;
      if (AppState.medicines[idx].qty > 1) {
        AppState.medicines[idx].qty--;
        renderMedicineRows();
      }
    });
  });

  container.querySelectorAll('.med-stepper-inc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.dataset.index;
      AppState.medicines[idx].qty++;
      renderMedicineRows();
    });
  });

  container.querySelectorAll('.med-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.dataset.index;
      AppState.medicines.splice(idx, 1);
      renderMedicineRows();
    });
  });
}

function addMedicineRow() {
  AppState.medicines.push({ name: "", strength: "", qty: 1 });
  renderMedicineRows();
  // Focus newly added row input
  const allInputs = document.querySelectorAll('.med-input-name');
  if (allInputs.length > 0) {
    allInputs[allInputs.length - 1].focus();
  }
}

// Client-Side Image Compression (Max 1600px, Quality 0.8)
async function compressImage(file, maxDimension = 1600, quality = 0.8) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return { blob: file, name: file.name, type: 'application/pdf' };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const safeName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
              resolve({ blob, name: safeName, type: 'image/jpeg' });
            } else {
              resolve({ blob: file, name: file.name, type: file.type || 'image/jpeg' });
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve({ blob: file, name: file.name, type: file.type || 'image/jpeg' });
      img.src = e.target.result;
    };
    reader.onerror = () => resolve({ blob: file, name: file.name, type: file.type || 'image/jpeg' });
    reader.readAsDataURL(file);
  });
}

// Prescription Upload Handlers
async function handleFileInputChange(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  for (const file of files) {
    await uploadPrescriptionFile(file);
  }
  e.target.value = '';
}

async function uploadPrescriptionFile(file) {
  if (AppState.simulateUploadFail) {
    document.getElementById('upload-error-box').style.display = 'flex';
    return;
  }

  if (AppState.prescriptions.length >= 5) {
    showToast(AppState.lang === 'en' ? "Maximum 5 prescription slips allowed" : "अधिकतम 5 पर्ची फ़ाइलें अपलोड की जा सकती हैं");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast(AppState.lang === 'en' ? "File exceeds 8MB limit" : "फ़ाइल का आकार 8MB से अधिक है");
    return;
  }

  const errBox = document.getElementById('upload-error-box');
  if (errBox) errBox.style.display = 'none';

  try {
    const { blob, name, type } = await compressImage(file, 1600, 0.8);

    const presignRes = await fetch('/api/v1/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: name,
        mimeType: type,
        fileSize: blob.size,
      }),
    });

    if (!presignRes.ok) {
      throw new Error('Presign failed');
    }

    const presignData = await presignRes.json();
    const fileKey = presignData.fileKey || presignData.file_key;
    const uploadUrl = presignData.uploadUrl;
    const publicUrl = presignData.publicUrl || `/public/uploads/${fileKey}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: blob,
    });

    if (!uploadRes.ok) {
      throw new Error('Storage upload failed');
    }

    const previewUrl = type.startsWith('image/') ? URL.createObjectURL(blob) : null;
    const rxItem = {
      fileKey,
      fileName: name,
      fileType: type,
      fileSize: blob.size,
      fileUrl: publicUrl,
      previewUrl,
    };

    AppState.prescriptions.push(rxItem);
    AppState.prescriptionImages.push(previewUrl || ASSETS.prescriptionMock);

    renderPrescriptionThumbnails();
    updateRxConsentVisibility();
    const itemsErr = document.getElementById('items-error-msg');
    if (itemsErr) itemsErr.classList.remove('visible');
    showToast(AppState.lang === 'en' ? "Prescription slip added" : "पर्ची जोड़ दी गई");
  } catch (err) {
    console.error('Prescription upload error:', err);
    if (errBox) errBox.style.display = 'flex';
  }
}

function retryUpload() {
  AppState.simulateUploadFail = false;
  const errBox = document.getElementById('upload-error-box');
  if (errBox) errBox.style.display = 'none';
  const galleryInput = document.getElementById('file-gallery-input');
  if (galleryInput) galleryInput.click();
}

function updateRxConsentVisibility() {
  const consentWrap = document.getElementById('rx-consent-wrap');
  if (!consentWrap) return;
  if (AppState.prescriptions.length > 0) {
    consentWrap.style.display = 'flex';
  } else {
    consentWrap.style.display = 'none';
    const chk = document.getElementById('rx-consent-check');
    if (chk) chk.checked = false;
    const errConsent = document.getElementById('err-rx-consent');
    if (errConsent) {
      errConsent.classList.remove('visible');
      errConsent.textContent = '';
    }
  }
}

function renderPrescriptionThumbnails() {
  const container = document.getElementById('prescription-thumbnails-list');
  container.innerHTML = '';

  AppState.prescriptions.forEach((rx, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb-item';
    if (rx.previewUrl) {
      thumb.innerHTML = `
        <img src="${rx.previewUrl}" class="thumb-img" alt="Prescription ${idx + 1}">
        <button type="button" class="thumb-remove-btn" data-index="${idx}" aria-label="Remove prescription">×</button>
      `;
    } else {
      thumb.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span style="font-size:11px; font-weight:700; color:var(--color-primary); margin-top:2px;">PDF</span>
        </div>
        <button type="button" class="thumb-remove-btn" data-index="${idx}" aria-label="Remove prescription">×</button>
      `;
    }
    container.appendChild(thumb);
  });

  container.querySelectorAll('.thumb-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      AppState.prescriptions.splice(idx, 1);
      AppState.prescriptionImages.splice(idx, 1);
      renderPrescriptionThumbnails();
      updateRxConsentVisibility();
    });
  });
}

// Current Location Auto-fill
function useCurrentLocation() {
  const locBtn = document.getElementById('use-current-location-btn');
  locBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
    </svg>
    <span>${AppState.lang === 'en' ? "Detecting Jamui location..." : "लोकेशन जांची जा रही है..."}</span>
  `;

  setTimeout(() => {
    document.getElementById('field-address').value = "Station Road, Ward No. 12";
    document.getElementById('field-landmark').value = "Near Gandhi Chowk, Jamui";
    document.getElementById('field-pincode').value = "811307";
    handlePincodeInput();

    locBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span id="use-current-location-text">${I18N[AppState.lang].useLocationBtn}</span>
    `;
    showToast(AppState.lang === 'en' ? "Location set: Station Road, Jamui (811307)" : "लोकेशन सेट हुई: स्टेशन रोड, जमुई");
  }, 350);
}

// Pincode validation
function handlePincodeInput() {
  const pin = document.getElementById('field-pincode').value.trim();
  const validBadge = document.getElementById('pincode-valid-badge');
  const invalidBadge = document.getElementById('pincode-invalid-badge');
  const dict = I18N[AppState.lang];

  if (pin.length === 6) {
    if (AppState.serviceablePincodes.includes(pin)) {
      validBadge.className = 'pincode-status-wrap serviceable';
      invalidBadge.className = 'pincode-status-wrap';
      document.getElementById('pincode-valid-text').textContent = dict.pincodeValidMsg;
      document.getElementById('field-pincode').classList.remove('error');
    } else {
      validBadge.className = 'pincode-status-wrap';
      invalidBadge.className = 'pincode-status-wrap unserviceable';
      document.getElementById('pincode-invalid-text').textContent = dict.pincodeInvalidMsg;
      document.getElementById('field-pincode').classList.add('error');
    }
  } else {
    validBadge.className = 'pincode-status-wrap';
    invalidBadge.className = 'pincode-status-wrap';
    document.getElementById('field-pincode').classList.remove('error');
  }
}

// Payment Option Card Select
function selectPaymentMethod(method) {
  if (!AppState.paymentsEnabled && method === 'online') {
    method = 'cod';
  }
  AppState.paymentMethod = method;
  const codCard = document.getElementById('pay-card-cod');
  const onlineCard = document.getElementById('pay-card-online');

  if (method === 'cod') {
    if (codCard) {
      codCard.classList.add('selected');
      codCard.setAttribute('aria-checked', 'true');
    }
    if (onlineCard) {
      onlineCard.classList.remove('selected');
      onlineCard.setAttribute('aria-checked', 'false');
    }
  } else {
    if (onlineCard) {
      onlineCard.classList.add('selected');
      onlineCard.setAttribute('aria-checked', 'true');
    }
    if (codCard) {
      codCard.classList.remove('selected');
      codCard.setAttribute('aria-checked', 'false');
    }
  }
}

// Form Submission & Inline Validation with Scroll-to-First-Error
async function handlePlaceOrder() {
  const dict = I18N[AppState.lang];
  let firstErrorElem = null;

  // Clear previous errors
  document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error-msg').forEach(el => {
    el.classList.remove('visible');
    el.textContent = '';
  });
  const itemsErr = document.getElementById('items-error-msg');
  if (itemsErr) itemsErr.classList.remove('visible');

  // Check items or prescriptions
  const validMedicines = AppState.medicines.filter(m => m.name && m.name.trim().length > 0);
  const hasTypedMedicine = validMedicines.length > 0;
  const hasPrescription = AppState.prescriptions.length > 0;
  if (!hasTypedMedicine && !hasPrescription) {
    if (itemsErr) {
      itemsErr.textContent = dict.errNoItems;
      itemsErr.classList.add('visible');
    }
    if (!firstErrorElem) firstErrorElem = document.getElementById('order-section-1');
  }

  // Prescription Consent Check (if prescription is attached)
  if (hasPrescription) {
    const consentCheck = document.getElementById('rx-consent-check');
    if (!consentCheck || !consentCheck.checked) {
      const errConsent = document.getElementById('err-rx-consent');
      if (errConsent) {
        errConsent.textContent = dict.rxConsentError;
        errConsent.classList.add('visible');
      }
      if (!firstErrorElem) firstErrorElem = document.getElementById('rx-consent-wrap');
    }
  }

  // Full Name (2+ characters)
  const nameInput = document.getElementById('field-full-name');
  const nameVal = nameInput.value.trim();
  if (nameVal.length < 2) {
    showFieldError(nameInput, 'err-name', dict.errName);
    if (!firstErrorElem) firstErrorElem = nameInput;
  }

  // Mobile Number (10 digits starting 6 to 9)
  const mobileInput = document.getElementById('field-mobile');
  const mobileVal = mobileInput.value.replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobileVal)) {
    showFieldError(mobileInput, 'err-mobile', dict.errMobile);
    if (!firstErrorElem) firstErrorElem = mobileInput;
  }

  // Address (House or area details)
  const addressInput = document.getElementById('field-address');
  const addressVal = addressInput.value.trim();
  if (addressVal.length < 3) {
    showFieldError(addressInput, 'err-address', dict.errAddress);
    if (!firstErrorElem) firstErrorElem = addressInput;
  }

  // Landmark
  const landmarkInput = document.getElementById('field-landmark');
  const landmarkVal = landmarkInput.value.trim();
  if (!landmarkVal) {
    showFieldError(landmarkInput, 'err-landmark', dict.errLandmark);
    if (!firstErrorElem) firstErrorElem = landmarkInput;
  }

  // Pincode (6 digits & Jamui 811307 serviceable check)
  const pinInput = document.getElementById('field-pincode');
  const pinVal = pinInput.value.replace(/\D/g, '');
  if (pinVal.length !== 6) {
    showFieldError(pinInput, 'err-pincode', dict.errPincode);
    if (!firstErrorElem) firstErrorElem = pinInput;
  } else if (!AppState.serviceablePincodes.includes(pinVal)) {
    showFieldError(pinInput, 'err-pincode', dict.errPincodeUnserviceable);
    if (!firstErrorElem) firstErrorElem = pinInput;
  }

  // If validation failed, scroll to first error without silently disabling button
  if (firstErrorElem) {
    firstErrorElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (firstErrorElem.focus) firstErrorElem.focus();
    return;
  }

  // Check offline state
  if (!navigator.onLine || AppState.isOffline) {
    document.getElementById('offline-alert-banner').classList.remove('hidden');
    showToast(dict.offlineNotice);
    return;
  }

  // Prepare payload
  const notesVal = document.getElementById('field-brand-notes').value.trim();
  const orderPayload = {
    name: nameVal,
    mobile: mobileVal,
    houseArea: addressVal,
    landmark: landmarkVal,
    pincode: pinVal,
    paymentMethod: AppState.paymentMethod,
    notes: notesVal || undefined,
    medicines: validMedicines.map(m => ({
      name: m.name.trim(),
      strength: m.strength ? m.strength.trim() : undefined,
      quantity: Number(m.qty) || 1,
    })),
    prescriptions: AppState.prescriptions.map(rx => ({
      fileUrl: rx.fileUrl,
      fileType: rx.fileType,
      fileSize: rx.fileSize,
    })),
  };

  const submitBtn = document.getElementById('place-order-submit-btn');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = `<span>${AppState.lang === 'en' ? 'Placing order...' : 'ऑर्डर भेजा जा रहा है...'}</span>`;

  try {
    const res = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();
    submitBtn.innerHTML = originalBtnHtml;

    if (!res.ok) {
      if (data.error === 'UNSERVICEABLE_PINCODE') {
        showFieldError(pinInput, 'err-pincode', dict.errPincodeUnserviceable);
        pinInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (data.error === 'CUSTOMER_BLOCKED') {
        showToast(AppState.lang === 'en' 
          ? "Account restricted. Please call support at +91 62078 56200."
          : "खाता प्रतिबंधित है। कृपया +91 62078 56200 पर संपर्क करें।");
      } else if (res.status === 429) {
        showToast(AppState.lang === 'en'
          ? "Order limit reached. Please call support or try later."
          : "ऑर्डर सीमा पूरी हो गई है। कृपया बाद में प्रयास करें।");
      } else {
        showToast(data.message || (AppState.lang === 'en' ? "Failed to place order" : "ऑर्डर विफल रहा"));
      }
      return;
    }

    // Success! Save customer to localStorage
    const savedCustomer = {
      name: nameVal,
      phone: mobileVal,
      address: addressVal,
      landmark: landmarkVal,
      pincode: pinVal,
      payment: AppState.paymentMethod,
    };
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(savedCustomer));
    AppState.returningCustomer = savedCustomer;

    // Save recent order
    AppState.activeOrder.orderId = data.orderNumber;
    AppState.activeOrder.trackingToken = data.trackingToken;
    AppState.activeOrder.paymentChosen = AppState.paymentMethod;
    AppState.fullName = nameVal;
    AppState.mobileNumber = mobileVal;
    AppState.address = addressVal;
    AppState.landmark = landmarkVal;
    AppState.pincode = pinVal;
    AppState.brandNotes = notesVal;

    localStorage.setItem('zupit.recent_order', JSON.stringify({
      orderNumber: data.orderNumber,
      trackingToken: data.trackingToken,
      createdAt: new Date().toISOString(),
    }));

    // Update history & route to /order/placed
    window.history.pushState({}, '', '/order/placed');
    navigateToScreen(2);
  } catch (err) {
    submitBtn.innerHTML = originalBtnHtml;
    console.error('Order submission network error:', err);
    document.getElementById('offline-alert-banner').classList.remove('hidden');
    showToast(dict.offlineNotice);
  }
}

function showFieldError(inputElem, errorSpanId, message) {
  inputElem.classList.add('error');
  const errSpan = document.getElementById(errorSpanId);
  if (errSpan) {
    errSpan.textContent = message;
    errSpan.classList.add('visible');
  }
}

// Screen 2: Order Placed Summary Render
function renderOrderPlacedSummary() {
  const dict = I18N[AppState.lang];
  document.getElementById('placed-order-id').textContent = AppState.activeOrder.orderId;

  // Item count summary
  let itemSummaryText;
  const validMeds = AppState.medicines.filter(m => m.name && m.name.trim().length > 0);
  const medCount = validMeds.length;
  const rxCount = AppState.prescriptions.length || AppState.prescriptionImages.length;

  if (medCount > 0 && rxCount > 0) {
    itemSummaryText = `${medCount} ${dict.summaryMedicines} + ${rxCount} ${dict.summaryPrescription}`;
  } else if (medCount > 0) {
    itemSummaryText = `${medCount} ${dict.summaryMedicines}`;
  } else if (rxCount > 0) {
    itemSummaryText = `${rxCount} ${dict.summaryPrescription}`;
  } else {
    itemSummaryText = `1 ${dict.summaryMedicines}`;
  }
  document.getElementById('summary-val-items').textContent = itemSummaryText;

  // Address
  const fullAddr = AppState.address ? `${AppState.address}, ${AppState.landmark || "Gandhi Chowk"}` : "Station Road, near Gandhi Chowk";
  document.getElementById('summary-val-address').textContent = fullAddr;

  // Payment choice
  const payLabel = AppState.activeOrder.paymentChosen === 'online' ? dict.payOnlineTitle : dict.payCodTitle;
  document.getElementById('summary-val-payment').textContent = payLabel;
}

// Polling Timer Reference
let pollTimer = null;

function startPolling(token) {
  stopPolling();
  if (!token) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState !== 'hidden' && AppState.currentScreen === 4 && AppState.activeOrder.trackingToken) {
      fetchTrackingData(AppState.activeOrder.trackingToken, true);
    }
  }, 10000); // 10 seconds
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function updateLiveIndicator() {
  const pollText = document.getElementById('tracking-poll-status-text');
  if (pollText) {
    pollText.textContent = I18N[AppState.lang].updatedJustNow || "Updated just now";
  }
}

function showNotFoundScreen() {
  const notFoundCard = document.getElementById('tracking-not-found-container');
  const activeContent = document.getElementById('tracking-active-content');
  if (notFoundCard) notFoundCard.style.display = 'flex';
  if (activeContent) activeContent.style.display = 'none';
}

function showTrackingActiveContent() {
  const notFoundCard = document.getElementById('tracking-not-found-container');
  const activeContent = document.getElementById('tracking-active-content');
  if (notFoundCard) notFoundCard.style.display = 'none';
  if (activeContent) activeContent.style.display = 'flex';
}

// Route Handler
function handleRoute() {
  const path = window.location.pathname;
  if (path.startsWith('/track/')) {
    const token = path.replace(/^\/track\//, '').split('/')[0].split('?')[0];
    if (token) {
      AppState.activeOrder.trackingToken = token;
      navigateToScreen(4);
      fetchTrackingData(token);
      return;
    }
  }
  if (path === '/track') {
    navigateToScreen(3);
    return;
  }
  if (path === '/order/placed') {
    navigateToScreen(2);
    return;
  }
  navigateToScreen(1);
}

// Fetch live order tracking data from GET /api/v1/track/[token]
async function fetchTrackingData(token, isBackground = false) {
  if (!token) return;
  try {
    const res = await fetch(`/api/v1/track/${encodeURIComponent(token)}`);
    if (res.status === 404 || !res.ok) {
      showNotFoundScreen();
      stopPolling();
      return;
    }

    const data = await res.json();
    if (!data.success || !data.order) {
      showNotFoundScreen();
      stopPolling();
      return;
    }

    const order = data.order;
    showTrackingActiveContent();

    // Map order fields to AppState
    AppState.activeOrder.orderId = order.orderNumber;
    AppState.activeOrder.orderNumber = order.orderNumber;
    AppState.activeOrder.trackingToken = token;
    AppState.activeOrder.status = order.status;
    AppState.trackingState = order.status;
    AppState.activeOrder.rider = order.rider;
    AppState.activeOrder.bills = order.bills || [];
    AppState.activeOrder.billAmount = order.final_amount || order.totalAmount || "0";
    AppState.activeOrder.final_amount = order.final_amount;
    AppState.activeOrder.paymentMethod = order.paymentMethod;
    AppState.activeOrder.paymentStatus = order.paymentStatus;
    AppState.activeOrder.paymentPaid = order.paymentStatus === 'paid';
    AppState.activeOrder.deliveryCode = order.deliveryCode;
    AppState.activeOrder.unavailableItem = order.unavailableItem;
    AppState.activeOrder.items = order.items || [];
    AppState.activeOrder.timeline = order.timeline || [];
    AppState.activeOrder.deliveryAddress = order.deliveryAddress;
    AppState.activeOrder.deliveryLandmark = order.deliveryLandmark;
    AppState.activeOrder.deliveryPhone = order.deliveryPhone;
    AppState.activeOrder.deliveryName = order.deliveryName;
    AppState.activeOrder.cancelReason = order.cancelReason;
    if (order.rating) {
      AppState.starsRating = order.rating.rating;
    }

    // Save to localStorage for recent-order card
    try {
      localStorage.setItem('zupit.recent_order', JSON.stringify({
        orderNumber: order.orderNumber,
        orderId: order.orderNumber,
        trackingToken: token,
        status: order.status,
        phone: order.deliveryPhone,
        address: order.deliveryAddress,
        updatedAt: new Date().toISOString(),
      }));
    } catch (e) {}

    // Render Screen
    if (AppState.currentScreen === 4) {
      if (order.status === 'delivered') {
        // If delivered, can show screen 7 or render on tracking screen
        navigateToScreen(7);
      } else {
        renderTrackingScreen();
      }
    } else if (AppState.currentScreen === 7 && order.status === 'delivered') {
      renderDeliveredScreen();
    }

    updateLiveIndicator();

    if (!pollTimer && document.visibilityState !== 'hidden') {
      startPolling(token);
    }
  } catch (err) {
    console.error('Error fetching order tracking info:', err);
    if (!isBackground) {
      showToast(AppState.lang === 'en' ? "Unable to connect to server" : "सर्वर से कनेक्ट करने में असमर्थ");
    }
  }
}

// Screen 3: Track Order Lookup
function renderTrackLookupView() {
  const recentCard = document.getElementById('recent-order-tappable-card');
  const emptyCard = document.getElementById('empty-orders-card');
  const errBox = document.getElementById('track-lookup-error');
  errBox.classList.remove('visible');

  const recentRaw = localStorage.getItem('zupit.recent_order');
  let recent = null;
  if (recentRaw) {
    try {
      recent = JSON.parse(recentRaw);
    } catch (e) {}
  }

  const activeId = recent ? (recent.orderNumber || recent.orderId) : AppState.activeOrder.orderId;
  const activeStatus = recent ? (recent.status || AppState.trackingState) : AppState.trackingState;
  const activeAddr = recent ? (recent.address || AppState.address) : AppState.address;

  if (activeId) {
    recentCard.style.display = 'flex';
    emptyCard.style.display = 'none';
    document.getElementById('recent-card-order-id').textContent = activeId;
    document.getElementById('recent-card-status').textContent = getStatusLabel(activeStatus);
    document.getElementById('recent-card-address').textContent = activeAddr || "Station Road, Jamui";
  } else {
    recentCard.style.display = 'none';
    emptyCard.style.display = 'flex';
  }
}

async function handleTrackLookup() {
  const mobileInput = document.getElementById('field-track-mobile').value.trim();
  const idInput = document.getElementById('field-track-id').value.trim().toUpperCase();
  const errBox = document.getElementById('track-lookup-error');
  const dict = I18N[AppState.lang];

  if (!idInput || !mobileInput) {
    errBox.textContent = dict.trackErrorMsg;
    errBox.classList.add('visible');
    return;
  }

  const submitBtn = document.getElementById('btn-track-lookup-submit');
  const origBtnText = document.getElementById('track-lookup-btn-text').textContent;
  submitBtn.disabled = true;
  document.getElementById('track-lookup-btn-text').textContent = AppState.lang === 'en' ? 'Checking...' : 'जाँच हो रही है...';

  try {
    const res = await fetch('/api/v1/track/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: mobileInput, orderNumber: idInput })
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.token) {
      errBox.textContent = data.message || dict.trackErrorMsg;
      errBox.classList.add('visible');
      return;
    }

    errBox.classList.remove('visible');
    AppState.activeOrder.trackingToken = data.token;
    AppState.activeOrder.orderId = data.orderNumber || idInput;
    window.history.pushState({}, '', `/track/${data.token}`);
    await fetchTrackingData(data.token);
    navigateToScreen(4);
  } catch (err) {
    console.error('Error during lookup:', err);
    errBox.textContent = dict.trackErrorMsg;
    errBox.classList.add('visible');
  } finally {
    submitBtn.disabled = false;
    document.getElementById('track-lookup-btn-text').textContent = origBtnText;
  }
}

// Screen 4: Order Tracking Logic & Frame States
function renderTrackingScreen() {
  const dict = I18N[AppState.lang];
  const state = AppState.trackingState;

  // Order ID
  document.getElementById('tracking-order-id').textContent = AppState.activeOrder.orderId || "ZP-10001";

  // Status Pill
  const pill = document.getElementById('tracking-status-pill');
  pill.className = `status-pill status-${getStatusPillClass(state)}`;
  document.getElementById('status-pill-text').textContent = getStatusLabel(state);

  // Vertical Stepper
  renderStepperNodes(state);

  // Rider Card: Visible once assigned
  const riderCard = document.getElementById('rider-info-card');
  const rider = AppState.activeOrder.rider;
  if (rider && rider.name) {
    riderCard.style.display = 'flex';
    const initials = rider.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SK';
    document.getElementById('rider-avatar-text').textContent = initials;
    document.getElementById('rider-name-text').textContent = rider.name;
    document.getElementById('rider-vehicle-text').textContent = `Vehicle: ${rider.vehicle || rider.vehicleNumber || 'BR-46-A-1284'}`;

    const callBtn = riderCard.querySelector('.rider-call-btn');
    const waBtn = riderCard.querySelector('.rider-wa-btn');
    const cleanPhone = (rider.phone || '6207856200').replace(/\D/g, '').slice(-10);
    if (callBtn) callBtn.href = `tel:+91${cleanPhone}`;
    if (waBtn) waBtn.href = `https://wa.me/91${cleanPhone}`;
  } else if (['assigned', 'rider_assigned', 'buying', 'out_for_delivery'].includes(state)) {
    // Demo fallback if rider simulated
    riderCard.style.display = 'flex';
  } else {
    riderCard.style.display = 'none';
  }

  // Bill Card: bill photo thumbnail (opens full screen), total in 32px semibold.
  const billCard = document.getElementById('bill-info-card');
  const bills = AppState.activeOrder.bills;
  const billAmount = AppState.activeOrder.final_amount || AppState.activeOrder.billAmount || AppState.activeOrder.totalAmount || "0";
  const numAmount = parseFloat(billAmount) || 0;
  const showBill = (bills && bills.length > 0) || ['buying', 'out_for_delivery', 'delivered'].includes(state) || numAmount > 0;

  if (showBill && numAmount > 0) {
    billCard.style.display = 'flex';
    document.getElementById('bill-amount-display').textContent = `₹ ${numAmount.toFixed(0)}`;

    const billThumb = document.getElementById('bill-thumb-img-preview');
    if (bills && bills.length > 0 && bills[0].billImageUrl) {
      billThumb.src = bills[0].billImageUrl;
    } else {
      billThumb.src = ASSETS.billThumbnail;
    }

    const payBtn = document.getElementById('btn-bill-pay-now');
    const codNote = document.getElementById('bill-cod-rider-note');

    if (AppState.paymentsEnabled && AppState.activeOrder.paymentMethod === 'online' && !AppState.activeOrder.paymentPaid) {
      payBtn.style.display = 'flex';
      codNote.style.display = 'none';
    } else if (AppState.paymentsEnabled && AppState.activeOrder.paymentMethod === 'online' && AppState.activeOrder.paymentPaid) {
      payBtn.style.display = 'none';
      codNote.style.display = 'block';
      codNote.textContent = AppState.lang === 'en' ? "Bill paid online via UPI" : "UPI द्वारा बिल भुगतान हो चुका है";
      codNote.style.color = "var(--color-success)";
    } else {
      // Cash payment: 'Pay ₹486 in cash to the rider'
      payBtn.style.display = 'none';
      codNote.style.display = 'block';
      const formattedAmt = numAmount.toFixed(0);
      codNote.textContent = dict.payCodToRider.replace('{amount}', formattedAmt);
      codNote.style.color = "var(--color-text-secondary)";
    }
  } else {
    billCard.style.display = 'none';
  }

  // Delivery Code Card: four boxes 56x64px, radius 12, 32px semibold tabular numbers.
  // Displayed ONLY while status is out_for_delivery
  const codeCard = document.getElementById('delivery-code-card');
  if (state === 'out_for_delivery') {
    codeCard.style.display = 'flex';
    const rawCode = String(AppState.activeOrder.deliveryCode || '4829').replace(/\s/g, '');
    document.getElementById('code-d1').textContent = rawCode[0] || '4';
    document.getElementById('code-d2').textContent = rawCode[1] || '8';
    document.getElementById('code-d3').textContent = rawCode[2] || '2';
    document.getElementById('code-d4').textContent = rawCode[3] || '9';
  } else {
    codeCard.style.display = 'none';
  }

  // Item Unavailable Alert Card: three buttons: Skip it, Call me, Cancel order
  const unavailAlert = document.getElementById('tracking-item-unavailable-alert');
  const unavailItem = AppState.activeOrder.unavailableItem;
  if (unavailAlert) {
    if (unavailItem) {
      unavailAlert.style.display = 'block';
      const descEl = document.getElementById('track-unavailable-desc');
      if (descEl) {
        descEl.textContent = AppState.lang === 'en'
          ? `${unavailItem.name} ${unavailItem.strength ? `(${unavailItem.strength})` : ''} was not available at the pharmacy.`
          : `${unavailItem.name} दवा दुकान पर उपलब्ध नहीं थी।`;
      }
    } else {
      unavailAlert.style.display = 'none';
    }
  }

  // Cancel order text link: only before buying (placed or rider_assigned)
  const cancelLink = document.getElementById('cancel-order-link-btn');
  if (['placed', 'assigned', 'rider_assigned'].includes(state)) {
    cancelLink.style.display = 'block';
  } else {
    cancelLink.style.display = 'none';
  }

  // Render Accordion details
  renderOrderAccordionDetails();
}

function renderStepperNodes(state) {
  const dict = I18N[AppState.lang];
  // Five steps: Placed, Rider assigned, Buying medicines, Out for delivery, Delivered
  const orderSteps = ['placed', 'rider_assigned', 'buying', 'out_for_delivery', 'delivered'];
  let normState = state;
  if (state === 'assigned') normState = 'rider_assigned';
  if (state === 'bill_online' || state === 'bill_cash') normState = 'buying';

  const currentIndex = orderSteps.indexOf(normState);

  // Extract timeline events
  const timelineMap = {};
  if (AppState.activeOrder.timeline && Array.isArray(AppState.activeOrder.timeline)) {
    AppState.activeOrder.timeline.forEach(ev => {
      if (ev.status && ev.createdAt) {
        timelineMap[ev.status] = formatTime(ev.createdAt);
      }
    });
  }

  const stepsConfig = [
    { key: 'placed', title: dict.statusStepPlaced, time: timelineMap['placed'] || (AppState.activeOrder.timestamps?.placed || '10:15 AM') },
    { key: 'rider_assigned', title: dict.statusStepAssigned, time: timelineMap['rider_assigned'] || (AppState.activeOrder.timestamps?.assigned || '—') },
    { key: 'buying', title: dict.statusStepBuying, time: timelineMap['buying'] || (AppState.activeOrder.timestamps?.buying || '—') },
    { key: 'out_for_delivery', title: dict.statusStepTransit, time: timelineMap['out_for_delivery'] || (AppState.activeOrder.timestamps?.out_for_delivery || '—') },
    { key: 'delivered', title: dict.statusStepDelivered, time: timelineMap['delivered'] || (AppState.activeOrder.timestamps?.delivered || '—') }
  ];

  const stepperContainer = document.getElementById('stepper-nodes-wrap');
  stepperContainer.innerHTML = '';

  stepsConfig.forEach((step, idx) => {
    const isCompleted = (normState === 'delivered') || (currentIndex !== -1 && idx < currentIndex);
    const isActive = idx === currentIndex && normState !== 'cancelled';

    let nodeClass = 'step-node';
    if (isCompleted) nodeClass += ' completed';
    if (isActive) nodeClass += ' active-step';

    const checkSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    const node = document.createElement('div');
    node.className = nodeClass;
    node.innerHTML = `
      <div class="step-axis">
        <div class="step-bullet">${isCompleted ? checkSvg : ''}</div>
        ${idx < stepsConfig.length - 1 ? '<div class="step-connector-line"></div>' : ''}
      </div>
      <div class="step-content">
        <span class="step-title">${step.title}</span>
        <span class="step-timestamp">${isCompleted || isActive ? step.time : '—'}</span>
      </div>
    `;

    // Make stepper nodes interactive for evaluator demo
    node.addEventListener('click', () => {
      setTrackingFrameState(step.key);
    });

    stepperContainer.appendChild(node);
  });
}

function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
}

function getStatusPillClass(state) {
  switch (state) {
    case 'placed': return 'placed';
    case 'assigned':
    case 'rider_assigned': return 'assigned';
    case 'buying': return 'buying';
    case 'bill_online':
    case 'bill_cash': return 'bill';
    case 'out_for_delivery': return 'transit';
    case 'delivered': return 'delivered';
    case 'cancelled': return 'cancelled';
    default: return 'placed';
  }
}

function getStatusLabel(state) {
  const dict = I18N[AppState.lang];
  switch (state) {
    case 'placed': return dict.statusStepPlaced;
    case 'assigned':
    case 'rider_assigned': return dict.statusStepAssigned;
    case 'buying': return dict.statusStepBuying;
    case 'bill_online':
    case 'bill_cash': return dict.billCardTitle;
    case 'out_for_delivery': return dict.statusStepTransit;
    case 'delivered': return dict.statusStepDelivered;
    case 'cancelled': return dict.statusStepCancelled;
    default: return dict.statusStepPlaced;
  }
}

function renderOrderAccordionDetails() {
  const itemsList = document.getElementById('accordion-items-list');
  itemsList.innerHTML = '';

  const items = AppState.activeOrder.items && AppState.activeOrder.items.length > 0
    ? AppState.activeOrder.items
    : AppState.medicines.filter(m => m.name && m.name.trim().length > 0);

  if (items.length > 0) {
    items.forEach(m => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      const strengthDisplay = m.strength ? ` (${m.strength})` : '';
      const qty = m.quantity || m.qty || 1;
      row.innerHTML = `
        <span class="summary-label">${m.name}${strengthDisplay}</span>
        <span class="summary-val">Qty: ${qty}</span>
      `;
      itemsList.appendChild(row);
    });
  }

  if (AppState.prescriptionImages.length > 0) {
    const pRow = document.createElement('div');
    pRow.className = 'summary-row';
    pRow.innerHTML = `
      <span class="summary-label">${I18N[AppState.lang].summaryPrescription}</span>
      <span class="summary-val">${AppState.prescriptionImages.length} slip(s)</span>
    `;
    itemsList.appendChild(pRow);
  }

  const addrVal = AppState.activeOrder.deliveryAddress || AppState.address || "Station Road";
  const landmarkVal = AppState.activeOrder.deliveryLandmark || AppState.landmark || "Gandhi Chowk";
  document.getElementById('accordion-address-val').textContent = `${addrVal}, ${landmarkVal}`;
}

function toggleOrderAccordion() {
  const body = document.getElementById('accordion-body-details');
  const icon = document.getElementById('accordion-chevron');
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    icon.style.transform = 'rotate(180deg)';
  } else {
    body.classList.add('collapsed');
    icon.style.transform = 'rotate(0deg)';
  }
}

// Lightbox for Bill Photo
function toggleBillLightbox(show) {
  const modal = document.getElementById('bill-lightbox-overlay');
  const img = document.getElementById('lightbox-bill-img');
  const bills = AppState.activeOrder.bills;
  if (bills && bills.length > 0 && bills[0].billImageUrl) {
    img.src = bills[0].billImageUrl;
  } else {
    img.src = ASSETS.billThumbnail;
  }

  if (show) {
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

// Cancel Order Dialog & Flow
function toggleCancelModal(show) {
  const modal = document.getElementById('cancel-modal-overlay');
  if (show) {
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

async function confirmOrderCancellation() {
  toggleCancelModal(false);
  const token = AppState.activeOrder.trackingToken;
  if (!token) {
    AppState.trackingState = 'cancelled';
    renderTrackingScreen();
    showToast(AppState.lang === 'en' ? "Order cancelled" : "ऑर्डर रद्द कर दिया गया");
    return;
  }

  try {
    const res = await fetch(`/api/v1/track/${encodeURIComponent(token)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelled by customer via tracking page' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || (AppState.lang === 'en' ? "Could not cancel order" : "ऑर्डर रद्द नहीं किया जा सका"));
      return;
    }
    showToast(AppState.lang === 'en' ? `Order ${AppState.activeOrder.orderId} cancelled` : "ऑर्डर रद्द कर दिया गया");
    await fetchTrackingData(token);
  } catch (err) {
    console.error('Error cancelling order:', err);
    showToast(AppState.lang === 'en' ? "Failed to cancel order" : "ऑर्डर रद्द करने में विफल");
  }
}

// Handle Customer Item Decisions: 'skip' | 'call_me' | 'cancel'
async function handleItemDecision(decision) {
  const token = AppState.activeOrder.trackingToken;
  const item = AppState.activeOrder.unavailableItem;

  if (!token || !item) {
    // Demo fallback
    if (decision === 'skip') {
      AppState.trackingState = 'buying';
      AppState.activeOrder.unavailableItem = null;
      renderTrackingScreen();
      showToast(AppState.lang === 'en' ? "Item skipped. Rider will purchase remaining medicines." : "दवा छोड़ दी गई। बाकी दवाइयां खरीदी जा रही हैं।");
    } else if (decision === 'call_me') {
      showToast(AppState.lang === 'en' ? "Rider will call you shortly." : "राइडर आपको कॉल करेंगे।");
    } else if (decision === 'cancel') {
      AppState.trackingState = 'cancelled';
      renderTrackingScreen();
      showToast(AppState.lang === 'en' ? "Order cancelled." : "ऑर्डर रद्द कर दिया गया।");
    }
    return;
  }

  try {
    const res = await fetch(`/api/v1/track/${encodeURIComponent(token)}/item-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, decision })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to update decision");
      return;
    }

    if (decision === 'skip') {
      showToast(AppState.lang === 'en' ? "Item skipped. Rider will purchase remaining medicines." : "दवा छोड़ दी गई। बाकी दवाइयां खरीदी जा रही हैं।");
    } else if (decision === 'call_me') {
      showToast(AppState.lang === 'en' ? "Rider will call you shortly." : "राइडर आपको कॉल करेंगे।");
    } else if (decision === 'cancel') {
      showToast(AppState.lang === 'en' ? "Order cancelled." : "ऑर्डर रद्द कर दिया गया।");
    }

    await fetchTrackingData(token);
  } catch (err) {
    console.error('Error updating item decision:', err);
    showToast(AppState.lang === 'en' ? "Failed to update decision" : "निर्णय दर्ज करने में विफल");
  }
}

// Screen 6: Payment Execution Simulation
function renderPaymentScreen() {
  const billAmount = AppState.activeOrder.billAmount;
  document.getElementById('pay-val-bill-total').textContent = `₹ ${billAmount}`;
  document.getElementById('pay-val-payable').textContent = `₹ ${billAmount}`;
  document.getElementById('btn-execute-payment').style.display = 'flex';
  document.getElementById('payment-success-card').style.display = 'none';
  document.getElementById('payment-fail-card').style.display = 'none';
}

function executePaymentSimulation() {
  const btn = document.getElementById('btn-execute-payment');
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    <span>${I18N[AppState.lang].paymentProcessing}</span>
  `;

  setTimeout(() => {
    btn.style.display = 'none';
    btn.innerHTML = `<span id="pay-execute-btn-text">${I18N[AppState.lang].btnPayAmount.replace('{amount}', AppState.activeOrder.billAmount)}</span>`;
    
    // Show success view
    document.getElementById('payment-success-card').style.display = 'flex';
  }, 700);
}

// Screen 7: Delivered Screen
function renderDeliveredScreen() {
  const amt = AppState.activeOrder.final_amount || AppState.activeOrder.billAmount || AppState.activeOrder.totalAmount || "0";
  document.getElementById('delivered-summary-paid-val').textContent = `₹ ${parseFloat(amt).toFixed(0)}`;
  setStarRating(AppState.starsRating || 5);

  const rider = AppState.activeOrder.rider;
  const riderElem = document.querySelector('#screen-7-view .placed-summary-card .summary-row:nth-child(2) .summary-val');
  if (riderElem && rider && rider.name) {
    riderElem.textContent = `${rider.name} (${rider.vehicle || rider.vehicleNumber || 'BR-46-A-1284'})`;
  }

  const timeElem = document.querySelector('#screen-7-view .placed-summary-card .summary-row:nth-child(3) .summary-val');
  if (timeElem && AppState.activeOrder.timeline) {
    const deliveredEv = AppState.activeOrder.timeline.find(e => e.status === 'delivered');
    if (deliveredEv) {
      timeElem.textContent = `${formatTime(deliveredEv.createdAt)}, Today`;
    }
  }
}

function setStarRating(rating) {
  AppState.starsRating = rating;
  document.querySelectorAll('.star-btn').forEach(btn => {
    const starVal = parseInt(btn.dataset.star, 10);
    if (starVal <= rating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function submitDeliveredRating() {
  const token = AppState.activeOrder.trackingToken;
  const stars = AppState.starsRating || 5;
  const commentBox = document.getElementById('feedback-textarea');
  const comment = commentBox ? commentBox.value.trim().slice(0, 300) : "";

  if (token) {
    try {
      const res = await fetch(`/api/v1/track/${encodeURIComponent(token)}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, comment })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(AppState.lang === 'en' ? "Thank you for rating your delivery!" : "डिलीवरी रेटिंग देने के लिए धन्यवाद!");
      }
    } catch (e) {
      console.error('Error submitting rating:', e);
    }
  }

  window.history.pushState({}, '', '/');
  navigateToScreen(1);
}

function handleOrderAgain() {
  if (AppState.activeOrder) {
    if (AppState.activeOrder.deliveryName) {
      document.getElementById('field-full-name').value = AppState.activeOrder.deliveryName;
    }
    if (AppState.activeOrder.deliveryPhone) {
      document.getElementById('field-mobile').value = AppState.activeOrder.deliveryPhone.replace(/\D/g, '').slice(-10);
    }
    if (AppState.activeOrder.deliveryAddress) {
      document.getElementById('field-house-flat').value = AppState.activeOrder.deliveryAddress;
    }
    if (AppState.activeOrder.deliveryLandmark) {
      document.getElementById('field-landmark').value = AppState.activeOrder.deliveryLandmark;
    }
    if (AppState.activeOrder.deliveryPincode) {
      document.getElementById('field-pincode').value = AppState.activeOrder.deliveryPincode;
      handlePincodeInput();
    }
  }
  window.history.pushState({}, '', '/');
  navigateToScreen(1);
}

// Help Sheet
function toggleHelpSheet(show) {
  const modal = document.getElementById('help-modal-overlay');
  if (show) {
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

// Offline Banner Toggle
function toggleOfflineBanner() {
  AppState.isOffline = !AppState.isOffline;
  const banner = document.getElementById('offline-alert-banner');
  if (AppState.isOffline) {
    banner.classList.remove('hidden');
    showToast(AppState.lang === 'en' ? "Simulated network offline" : "ऑफ़लाइन मोड चालू");
  } else {
    banner.classList.add('hidden');
    showToast(AppState.lang === 'en' ? "Network restored" : "इंटरनेट बहाल हुआ");
  }
}

// Upload Error Simulation Toggle
function toggleUploadErrorSimulation() {
  AppState.simulateUploadFail = !AppState.simulateUploadFail;
  showToast(AppState.simulateUploadFail ? "Next upload will fail (for error testing)" : "Upload error simulation turned off");
}

// Returning Customer Seed Toggle
function toggleReturningCustomerSeed() {
  const card = document.getElementById('returning-customer-card');
  if (card.style.display === 'none') {
    card.style.display = 'flex';
    showToast("Returning customer card enabled");
  } else {
    card.style.display = 'none';
    showToast("Returning customer card hidden");
  }
}

// Demo Controls: Advance sequence
function advanceToNextState() {
  const sequence = ['placed', 'assigned', 'buying', 'bill_online', 'out_for_delivery', 'delivered'];
  const curIdx = sequence.indexOf(AppState.trackingState);
  if (curIdx === -1 || curIdx >= sequence.length - 1) {
    setTrackingFrameState('placed');
  } else {
    setTrackingFrameState(sequence[curIdx + 1]);
  }
}

function setTrackingFrameState(frameKey) {
  AppState.trackingState = frameKey;
  if (frameKey === 'delivered') {
    navigateToScreen(7);
  } else {
    if (AppState.currentScreen !== 4) {
      navigateToScreen(4);
    } else {
      renderTrackingScreen();
    }
  }
  updateDemoToolbarStatus();
}

function updateDemoToolbarStatus() {
  const tag = document.getElementById('demo-current-screen-tag');
  if (!tag) return;
  const screenNames = {
    1: "Screen 1: New Order",
    2: "Screen 2: Order Placed",
    3: "Screen 3: Track Lookup",
    4: `Screen 4: Tracking (${AppState.trackingState})`,
    5: "Screen 5: Item Unavailable",
    6: "Screen 6: Payment",
    7: "Screen 7: Delivered"
  };
  tag.textContent = screenNames[AppState.currentScreen] || "Screen 1";

  // Update active pill in demo toolbar
  document.querySelectorAll('.demo-frame-btn').forEach(btn => {
    if (btn.dataset.state === AppState.trackingState && AppState.currentScreen === 4) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('app-toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
}
