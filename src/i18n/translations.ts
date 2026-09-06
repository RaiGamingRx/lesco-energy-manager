export type Language = 'en' | 'ur';

export type TranslationKey =
  | 'app_title'
  | 'app_tagline'
  | 'protected_plan'
  | 'no_active_cycle'
  | 'no_active_cycle_desc'
  | 'current_bill_period'
  | 'cycle_day_progress'
  | 'used_this_cycle'
  | 'of_limit'
  | 'units_left_before_limit'
  | 'units_over_limit'
  | 'status_on_track'
  | 'status_getting_close'
  | 'status_near_limit'
  | 'status_exceeded'
  | 'status_desc_on_track'
  | 'status_desc_getting_close'
  | 'status_desc_near_limit'
  | 'status_desc_exceeded'
  | 'safe_target_label'
  | 'limit_label'
  | 'expected_total'
  | 'expected_units_projected'
  | 'forecast_under'
  | 'forecast_over'
  | 'forecast_basis'
  | 'forecast_recent_trend'
  | 'forecast_cycle_average'
  | 'estimated_bill_cost'
  | 'so_far_this_cycle'
  | 'expected_final_bill'
  | 'bill_under_msg'
  | 'bill_jump_warning'
  | 'protected_plan_active'
  | 'safe_daily_use'
  | 'safe_daily_desc'
  | 'current_daily_avg'
  | 'current_daily_desc'
  | 'latest_reading'
  | 'physical_meter_value'
  | 'match_your_meter'
  | 'outdoor_gap'
  | 'outdoor_gap_desc'
  | 'recommended_next_step'
  | 'today_logged_title'
  | 'today_logged_desc'
  | 'today_pending_title'
  | 'today_pending_desc'
  | 'log_meter_reading'
  | 'recent_readings'
  | 'recent_readings_desc'
  | 'reading_time'
  | 'meter_reading'
  | 'usage_since_last_reading'
  | 'source'
  | 'no_readings_recorded'
  | 'source_official'
  | 'source_user'
  | 'source_calculated'
  | 'source_expected'
  | 'nav_overview'
  | 'nav_readings'
  | 'nav_bills'
  | 'nav_history'
  | 'nav_settings'
  | 'nav_log'
  | 'enter_new_bill'
  | 'add_bill'
  | 'bills_subtitle'
  | 'active_bill_period_title'
  | 'in_progress'
  | 'finished'
  | 'lesco_reading_date'
  | 'lesco_reader_visit'
  | 'bill_base_reading'
  | 'baseline_for_cycle'
  | 'reconciled_difference'
  | 'sub_meter_sync'
  | 'reset_confirmed'
  | 'pending_reset'
  | 'meter_reading_at_sync'
  | 'lesco_bill_ref'
  | 'not_synced'
  | 'finish_bill_period'
  | 'finish_bill_period_confirm'
  | 'billed_units'
  | 'billed_amount'
  | 'meter_readings_range'
  | 'past_bill_records'
  | 'history_subtitle'
  | 'tab_past_cycles'
  | 'tab_audit_trail'
  | 'avg_usage'
  | 'across_closed_cycles'
  | 'avg_bill'
  | 'lowest_period'
  | 'highest_period'
  | 'ended_on'
  | 'empty_history_title'
  | 'empty_history_desc'
  | 'ceiling_preserved'
  | 'ceiling_exceeded'
  | 'target_achieved'
  | 'target_missed'
  | 'audit_trail_title'
  | 'audit_trail_desc'
  | 'no_audit_records'
  | 'settings_title'
  | 'settings_subtitle'
  | 'section_appearance'
  | 'appearance_desc'
  | 'theme_light'
  | 'theme_dark'
  | 'theme_auto'
  | 'theme_auto_desc'
  | 'section_language'
  | 'language_desc'
  | 'lang_english'
  | 'lang_urdu'
  | 'pwa_title'
  | 'pwa_desc'
  | 'pwa_install_btn'
  | 'pwa_installed'
  | 'section_tracking_mode'
  | 'mode_indoor_title'
  | 'mode_indoor_desc'
  | 'mode_outdoor_title'
  | 'mode_outdoor_desc'
  | 'official_protected_limit'
  | 'statutory_limit_desc'
  | 'personal_target_input'
  | 'personal_target_desc'
  | 'preferred_time_input'
  | 'preferred_time_desc'
  | 'section_household'
  | 'premise_name'
  | 'city_division'
  | 'lesco_ref_input'
  | 'consumer_no_input'
  | 'btn_save_config'
  | 'section_scenarios'
  | 'scenarios_desc'
  | 'scenario_1_title'
  | 'scenario_1_desc'
  | 'scenario_2_title'
  | 'scenario_2_desc'
  | 'scenario_3_title'
  | 'scenario_3_desc'
  | 'scenario_4_title'
  | 'scenario_4_desc'
  | 'section_portability'
  | 'btn_export_backup'
  | 'btn_export_csv'
  | 'btn_import_backup'
  | 'btn_reset_data'
  | 'reset_data_confirm'
  | 'modal_add_title'
  | 'modal_add_subtitle'
  | 'modal_edit_title'
  | 'modal_edit_subtitle'
  | 'cumulative_meter_val'
  | 'physical_reading_time'
  | 'added_to_app'
  | 'notes_optional'
  | 'reason_for_correction'
  | 'prev_reading_note'
  | 'edit_audit_warning'
  | 'btn_apply_correction'
  | 'btn_save_reading'
  | 'btn_delete'
  | 'btn_cancel'
  | 'delete_reading_confirm'
  | 'match_meter_title'
  | 'match_meter_subtitle'
  | 'lesco_bill_reading'
  | 'official_date'
  | 'meter_reading_at_match'
  | 'resulting_gap'
  | 'confirm_unusual_gap'
  | 'btn_confirm_match'
  | 'val_reading_positive'
  | 'val_reading_future'
  | 'val_reading_duplicate'
  | 'val_reading_lower'
  | 'val_reading_higher'
  | 'val_outdoor_lower'
  | 'offline_notice'
  | 'settings_saved_msg';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    app_title: 'LESCO Energy',
    app_tagline: 'Household Electricity Manager',
    protected_plan: '200 kWh Protected Plan',
    no_active_cycle: 'No active bill period',
    no_active_cycle_desc: 'Enter your latest LESCO bill to activate exact daily pace calculations and limit tracking.',
    current_bill_period: 'This bill period',
    cycle_day_progress: 'Day {elapsed} of {total} ({remaining} days left)',
    used_this_cycle: 'Used this cycle',
    of_limit: '/ {ceiling} units',
    units_left_before_limit: '{remaining} units left before the 200-unit limit',
    units_over_limit: '{over} units over the 200-unit limit',
    status_on_track: "You're on track",
    status_getting_close: "You're getting close",
    status_near_limit: 'Very close to 200 units',
    status_exceeded: '200-unit limit passed',
    status_desc_on_track: 'Your daily use is safely within the protected plan limit.',
    status_desc_getting_close: 'Your usage is approaching your personal safety target. Try to conserve.',
    status_desc_near_limit: 'You are very close to 200 units. Heavy surcharges apply if exceeded.',
    status_desc_exceeded: 'You have crossed 200 units. Higher unbuffered rates now apply.',
    safe_target_label: 'Target: {target} units',
    limit_label: 'Limit: {ceiling} units',
    expected_total: 'Expected total',
    expected_units_projected: '{units} units expected',
    forecast_under: 'Expected to stay {under} units below the 200 limit by bill end.',
    forecast_over: "You're on track to go over 200 units. Trim daily use to stay protected.",
    forecast_basis: 'Calculation basis:',
    forecast_recent_trend: 'Recent 4-day pace',
    forecast_cycle_average: 'Cycle daily average',
    estimated_bill_cost: 'Estimated bill cost',
    so_far_this_cycle: 'So far this cycle',
    expected_final_bill: 'Expected final bill',
    bill_under_msg: 'Protected plan rate applied (~Rs 7.74/unit base). Staying under 200 saves ~Rs 5,000+ in extra charges.',
    bill_jump_warning: 'Rate jump warning: Going over 200 units triggers higher base rates, extra taxes, and fuel surcharges.',
    protected_plan_active: 'Protected Plan Active',
    safe_daily_use: 'Safe daily use',
    safe_daily_desc: 'To hit {target} target',
    current_daily_avg: 'Current daily average',
    current_daily_desc: 'Over {days} recorded days',
    latest_reading: 'Latest reading',
    physical_meter_value: 'Dial value on meter',
    match_your_meter: 'Match your meter',
    outdoor_gap: 'Usage difference',
    outdoor_gap_desc: 'Reconciled from bill',
    recommended_next_step: 'Recommended next step',
    today_logged_title: "Today's reading is logged",
    today_logged_desc: 'Great job! Adding readings around the same time keeps pace forecasts accurate.',
    today_pending_title: "Log today's reading",
    today_pending_desc: 'Recommended around {time}. Take a minute to check your meter dial.',
    log_meter_reading: 'Log Reading',
    recent_readings: 'Recent Readings',
    recent_readings_desc: 'Sequential meter readings with validated usage since last reading',
    reading_time: 'Reading time',
    meter_reading: 'Meter reading',
    usage_since_last_reading: 'Usage since last reading',
    source: 'Source',
    no_readings_recorded: 'No readings recorded for this bill period yet.',
    source_official: 'From LESCO bill',
    source_user: 'Entered by you',
    source_calculated: 'Calculated',
    source_expected: 'Expected',
    nav_overview: 'Overview',
    nav_readings: 'Readings',
    nav_bills: 'Bills',
    nav_history: 'History',
    nav_settings: 'Settings',
    nav_log: 'Log',
    enter_new_bill: 'Enter New Bill',
    add_bill: 'Add Bill',
    bills_subtitle: 'Official LESCO utility bills, cycle periods, and meter reconciliation',
    active_bill_period_title: 'Active bill period: {start} to {end}',
    in_progress: 'In Progress',
    finished: 'Finished',
    lesco_reading_date: 'LESCO reading date',
    lesco_reader_visit: 'Meter reader visit',
    bill_base_reading: 'Bill base reading',
    baseline_for_cycle: 'Baseline for cycle',
    reconciled_difference: 'Reconciled difference',
    sub_meter_sync: 'Sub-meter sync',
    reset_confirmed: 'Reset (000.0)',
    pending_reset: 'Pending Reset',
    meter_reading_at_sync: 'Outdoor reading at sync:',
    lesco_bill_ref: 'LESCO bill ref:',
    not_synced: 'Not synced',
    finish_bill_period: 'Finish this bill period',
    finish_bill_period_confirm: 'Are you sure you want to lock and finish this bill period? Make sure all readings for this period have been entered.',
    billed_units: 'Billed units',
    billed_amount: 'Billed amount',
    meter_readings_range: 'Meter readings',
    past_bill_records: 'Billing Cycles Record ({count})',
    history_subtitle: 'Compare past bill periods, performance under 200 units, and audit trail',
    tab_past_cycles: 'Past Bill Periods ({count})',
    tab_audit_trail: 'Audit Trail ({count})',
    avg_usage: 'Average Usage',
    across_closed_cycles: 'Across {count} closed periods',
    avg_bill: 'Average Bill',
    lowest_period: 'Lowest Period',
    highest_period: 'Highest Period',
    ended_on: 'Ended {date}',
    empty_history_title: 'Completed bill periods will appear here',
    empty_history_desc: 'Once an active bill period ends and you confirm the subsequent LESCO bill, full cycle reconciliation and comparison metrics are locked here.',
    ceiling_preserved: '✓ Under 200 Limit',
    ceiling_exceeded: '✗ Over 200 Limit',
    target_achieved: '✓ Safe Target Met',
    target_missed: 'Over Target',
    audit_trail_title: 'Local Audit History',
    audit_trail_desc: 'Every entry, user correction, or cycle finalization is permanently recorded to guarantee data integrity.',
    no_audit_records: 'No audit records yet.',
    settings_title: 'Settings',
    settings_subtitle: 'Configure appearance, language, tracking modes, 200-unit targets, or backup data',
    section_appearance: 'Appearance',
    appearance_desc: 'Choose how LESCO Energy looks on your device',
    theme_light: 'Light',
    theme_dark: 'Dark',
    theme_auto: 'Auto',
    theme_auto_desc: 'Follows device system setting',
    section_language: 'Language',
    language_desc: 'Choose your preferred language',
    lang_english: 'English',
    lang_urdu: 'اردو',
    pwa_title: 'Progressive Web App',
    pwa_desc: 'Install on your phone home screen for offline logging and instant launch.',
    pwa_install_btn: 'Install App',
    pwa_installed: 'Installed',
    section_tracking_mode: 'Household Meter Tracking Mode',
    mode_indoor_title: 'Mode A: Indoor Cumulative',
    mode_indoor_desc: 'Log daily from your indoor sub-meter. When a bill arrives, match with the outdoor LESCO meter to account for unlogged gap units.',
    mode_outdoor_title: 'Mode B: Direct Outdoor Meter',
    mode_outdoor_desc: 'Log cumulative readings directly from the official outdoor LESCO meter. Zero reconciliation gap needed.',
    official_protected_limit: 'Official Protected Ceiling',
    statutory_limit_desc: 'Statutory limit (200 units)',
    personal_target_input: 'Personal Safe Target (units)',
    personal_target_desc: 'Recommended safety buffer: 190',
    preferred_time_input: 'Preferred Daily Check Time',
    preferred_time_desc: 'Recommended ~6:00 PM',
    section_household: 'Household Information',
    premise_name: 'Household / Premise Name',
    city_division: 'City / Division',
    lesco_ref_input: 'LESCO Reference Number',
    consumer_no_input: 'Consumer Number',
    btn_save_config: 'Save Settings',
    section_scenarios: 'Realistic Scenario Testing',
    scenarios_desc: 'Load real-world test cases to verify pacing forecasts, tariff transitions, and safe daily limits:',
    scenario_1_title: 'Scenario 1: Steady 180 kWh Pace',
    scenario_1_desc: 'Consistent daily usage of ~5.8 units/day safely below 190.',
    scenario_2_title: 'Scenario 2: Heatwave Spike Risk',
    scenario_2_desc: 'Sudden AC run-rate jump to 9.2 units/day; projected 216 units.',
    scenario_3_title: 'Scenario 3: Delayed Bill (4.2 Gap)',
    scenario_3_desc: 'Bill arrives late; accounts for outdoor gap units correctly.',
    scenario_4_title: 'Scenario 4: 5-Day Logging Gap',
    scenario_4_desc: 'Interval prorated evenly across the missing period.',
    section_portability: 'Data Portability & Reset',
    btn_export_backup: 'Export Backup (JSON)',
    btn_export_csv: 'Export Readings (CSV)',
    btn_import_backup: 'Import Backup',
    btn_reset_data: 'Reset Data',
    reset_data_confirm: 'Reset all readings, cycles, and audit logs to clean initial sample state?',
    modal_add_title: 'Log Meter Reading',
    modal_add_subtitle: 'Enter the current reading from your meter',
    modal_edit_title: 'Correct Meter Reading',
    modal_edit_subtitle: 'Edits are transparently logged in audit trail',
    cumulative_meter_val: 'Cumulative Reading (kWh)',
    physical_reading_time: 'Reading Time',
    added_to_app: 'Added to app',
    notes_optional: 'Notes (Optional)',
    reason_for_correction: 'Reason for Correction *',
    prev_reading_note: 'Previous reading was {val} kWh ({time})',
    edit_audit_warning: 'This will update the reading and record a permanent audit entry showing previous value {oldVal} and new value {newVal}.',
    btn_apply_correction: 'Apply Correction',
    btn_save_reading: 'Save Reading',
    btn_delete: 'Delete',
    btn_cancel: 'Cancel',
    delete_reading_confirm: 'Are you sure you want to delete this meter reading? This cannot be undone.',
    match_meter_title: 'Match Your Meter',
    match_meter_subtitle: 'Reconcile official outdoor meter reading with your bill',
    lesco_bill_reading: 'LESCO Bill Reading:',
    official_date: 'Official Reading Date:',
    meter_reading_at_match: 'Outdoor Meter Reading at Match (kWh)',
    resulting_gap: 'Resulting Gap Units:',
    confirm_unusual_gap: 'Confirm this value is correct',
    btn_confirm_match: 'Confirm Match',
    val_reading_positive: 'Please enter a valid positive meter reading.',
    val_reading_future: "Reading time can't be in the future.",
    val_reading_duplicate: 'A reading with this exact time and value already exists.',
    val_reading_lower: 'This reading is lower than your last reading. Please check the number.',
    val_reading_higher: 'This reading is higher than a later reading. Please check the date and number.',
    val_outdoor_lower: 'Outdoor reading cannot be less than the bill reading.',
    offline_notice: "You're offline. Changes are saved locally on your device.",
    settings_saved_msg: 'Settings successfully saved.',
  },
  ur: {
    app_title: 'لیسکو انرجی',
    app_tagline: 'گھریلو بجلی مینیجر',
    protected_plan: '200 یونٹ محفوظ پلان',
    no_active_cycle: 'کوئی فعال بل دورانیہ نہیں',
    no_active_cycle_desc: 'صحیح روزانہ رفتار اور 200 یونٹس کی حد ٹریک کرنے کے لیے اپنا تازہ ترین لیسکو بل درج کریں۔',
    current_bill_period: 'بل کا موجودہ دورانیہ',
    cycle_day_progress: 'دن {elapsed} از {total} ({remaining} دن باقی)',
    used_this_cycle: 'استعمال شدہ یونٹس',
    of_limit: '/ {ceiling} یونٹس',
    units_left_before_limit: '200 یونٹس کی حد سے پہلے {remaining} یونٹس باقی ہیں',
    units_over_limit: '200 یونٹس کی حد سے {over} یونٹس زیادہ',
    status_on_track: 'آپ ابھی محفوظ حد میں ہیں',
    status_getting_close: 'آپ 200 یونٹس کے قریب پہنچ رہے ہیں',
    status_near_limit: '200 یونٹس کی حد کے بالکل قریب',
    status_exceeded: '200 یونٹس کی حد پار ہو گئی ہے',
    status_desc_on_track: 'آپ کا روزانہ استعمال محفوظ حد کے اندر ہے اور سستے ریٹ پر رہے گا۔',
    status_desc_getting_close: 'آپ کا استعمال حفاظتی حد کے قریب پہنچ رہا ہے۔ احتیاط سے استعمال کریں۔',
    status_desc_near_limit: 'آپ 200 یونٹس کی حد کے انتہائی قریب ہیں۔ حد پار ہونے پر بھاری نرخ لاگو ہوں گے۔',
    status_desc_exceeded: 'آپ 200 یونٹس سے تجاوز کر چکے ہیں۔ اب مہنگے غیر محفوظ نرخ لاگو ہوں گے۔',
    safe_target_label: 'ہدف: {target} یونٹس',
    limit_label: 'سرکاری حد: {ceiling} یونٹس',
    expected_total: 'متوقع کل استعمال',
    expected_units_projected: 'متوقع {units} یونٹ',
    forecast_under: 'بل کے اختتام تک 200 کی حد سے {under} یونٹ کم رہنے کی توقع ہے۔',
    forecast_over: 'موجودہ استعمال کے حساب سے 200 یونٹس سے اوپر جانے کا امکان ہے۔ روزانہ استعمال کم کریں۔',
    forecast_basis: 'تخمینہ کی بنیاد:',
    forecast_recent_trend: 'گزشتہ 4 دن کی رفتار',
    forecast_cycle_average: 'پورے دورانیے کی اوسط',
    estimated_bill_cost: 'متوقع بل کا خرچہ',
    so_far_this_cycle: 'اب تک کا خرچہ',
    expected_final_bill: 'متوقع کل بل',
    bill_under_msg: 'محفوظ نرخ لاگو ہیں (~7.74 روپے فی یونٹ)۔ 200 سے کم رہنے سے ہزاروں روپے کی بچت ہوگی۔',
    bill_jump_warning: 'خبردار: 200 یونٹس سے زیادہ ہونے پر بنیادی ریٹ بڑھ جائے گا اور اضافی ٹیکسز لاگو ہوں گے۔',
    protected_plan_active: 'محفوظ پلان فعال ہے',
    safe_daily_use: 'روزانہ محفوظ استعمال',
    safe_daily_desc: 'ہدف {target} کے اندر رہنے کے لیے',
    current_daily_avg: 'موجودہ روزانہ اوسط',
    current_daily_desc: 'درج شدہ {days} دنوں کے دوران',
    latest_reading: 'آخری میٹر ریڈنگ',
    physical_meter_value: 'میٹر پر موجود ریڈنگ',
    match_your_meter: 'میٹر ملائیں',
    outdoor_gap: 'میٹر کا فرق',
    outdoor_gap_desc: 'بل ملاپ کے بعد',
    recommended_next_step: 'اگلا تجویز کردہ قدم',
    today_logged_title: 'آج کی ریڈنگ درج ہو چکی ہے',
    today_logged_desc: 'بہت خوب! روزانہ ایک ہی وقت پر ریڈنگ لینے سے تخمینہ بالکل درست رہتا ہے۔',
    today_pending_title: 'آج کی ریڈنگ درج کریں',
    today_pending_desc: 'تجویز کردہ وقت: تقریباً {time} بجے۔ میٹر دیکھ کر ریڈنگ درج کریں۔',
    log_meter_reading: 'ریڈنگ شامل کریں',
    recent_readings: 'حالیہ ریڈنگز',
    recent_readings_desc: 'آپ کی تازہ ترین میٹر ریڈنگز اور ان کے درمیان استعمال',
    reading_time: 'ریڈنگ کا وقت',
    meter_reading: 'میٹر ریڈنگ',
    usage_since_last_reading: 'پچھلی ریڈنگ کے بعد استعمال',
    source: 'ماخذ',
    no_readings_recorded: 'اس دورانیے میں ابھی تک کوئی ریڈنگ درج نہیں ہوئی۔',
    source_official: 'لیسکو بل کے مطابق',
    source_user: 'آپ کی درج کردہ',
    source_calculated: 'حساب شدہ',
    source_expected: 'متوقع',
    nav_overview: 'خلاصہ',
    nav_readings: 'ریڈنگز',
    nav_bills: 'بلز',
    nav_history: 'ریکارڈ',
    nav_settings: 'ترتیبات',
    nav_log: 'شامل کریں',
    enter_new_bill: 'نیا بل درج کریں',
    add_bill: 'بل شامل کریں',
    bills_subtitle: 'سرکاری لیسکو بلز، بل کا دورانیہ اور میٹر کا ملاپ',
    active_bill_period_title: 'جاری بل دورانیہ: {start} تا {end}',
    in_progress: 'جاری ہے',
    finished: 'مکمل',
    lesco_reading_date: 'لیسکو ریڈنگ کی تاریخ',
    lesco_reader_visit: 'میٹر ریڈر کا دورہ',
    bill_base_reading: 'بل کی بنیادی ریڈنگ',
    baseline_for_cycle: 'دورانیے کی شروعات',
    reconciled_difference: 'حساب شدہ فرق',
    sub_meter_sync: 'ذیلی میٹر ملاپ',
    reset_confirmed: 'ری سیٹ (000.0)',
    pending_reset: 'ری سیٹ باقی ہے',
    meter_reading_at_sync: 'ملاپ کے وقت بیرونی ریڈنگ:',
    lesco_bill_ref: 'لیسکو بل ریفرنس:',
    not_synced: 'ملاپ نہیں ہوا',
    finish_bill_period: 'یہ دورانیہ مکمل کریں',
    finish_bill_period_confirm: 'کیا آپ واقعی یہ بل دورانیہ بند کرنا چاہتے ہیں؟ تصدیق کر لیں کہ اس دورانیے کی تمام ریڈنگز درج ہو چکی ہیں۔',
    billed_units: 'بل کے کل یونٹس',
    billed_amount: 'بل کی رقم',
    meter_readings_range: 'میٹر ریڈنگز',
    past_bill_records: 'بل دورانیوں کا ریکارڈ ({count})',
    history_subtitle: 'ماضی کے بل دورانیوں کا موازنہ، 200 یونٹس کی کارکردگی اور آڈٹ ٹریل',
    tab_past_cycles: 'ماضی کے دورانیے ({count})',
    tab_audit_trail: 'تبدیلیوں کا ریکارڈ ({count})',
    avg_usage: 'اوسط استعمال',
    across_closed_cycles: '{count} مکمل دورانیوں کی اوسط',
    avg_bill: 'اوسط بل',
    lowest_period: 'سب سے کم استعمال',
    highest_period: 'سب سے زیادہ استعمال',
    ended_on: 'اختتام: {date}',
    empty_history_title: 'مکمل ہونے والے دورانیے یہاں نظر آئیں گے',
    empty_history_desc: 'جب موجودہ بل دورانیہ مکمل ہو جائے گا اور آپ نیا بل درج کریں گے، تو مکمل ریکارڈ یہاں محفوظ ہو جائے گا۔',
    ceiling_preserved: '✓ 200 کی محفوظ حد برقرار',
    ceiling_exceeded: '✗ 200 کی حد سے تجاوز',
    target_achieved: '✓ حفاظتی ہدف حاصل ہوا',
    target_missed: 'ہدف سے زیادہ',
    audit_trail_title: 'تبدیلیوں کا مکمل ریکارڈ',
    audit_trail_desc: 'ڈیٹا کے تحفظ کے لیے ہر ریڈنگ کا اندراج، درستگی اور بل کی بندش مستقل طور پر محفوظ رہتی ہے۔',
    no_audit_records: 'ابھی کوئی ریکارڈ موجود نہیں۔',
    settings_title: 'ترتیبات',
    settings_subtitle: 'ظاہری شکل، زبان، میٹر ٹریکنگ کا طریقہ، ہدف یا ڈیٹا بیک اپ سیٹ کریں',
    section_appearance: 'ظاہری شکل (تھیم)',
    appearance_desc: 'اپنی پسند کے مطابق ایپ کا انداز منتخب کریں',
    theme_light: 'روشن (Light)',
    theme_dark: 'تاریک (Dark)',
    theme_auto: 'خودکار (Auto)',
    theme_auto_desc: 'ڈیوائس کی سسٹم سیٹنگز کے مطابق',
    section_language: 'زبان (Language)',
    language_desc: 'ایپ کے لیے اپنی زبان منتخب کریں',
    lang_english: 'English',
    lang_urdu: 'اردو',
    pwa_title: 'ایپ انسٹالیشن',
    pwa_desc: 'انٹرنیٹ کے بغیر بھی فوری استعمال کے لیے ہوم اسکرین پر انسٹال کریں۔',
    pwa_install_btn: 'ایپ انسٹال کریں',
    pwa_installed: 'انسٹال شدہ',
    section_tracking_mode: 'میٹر ٹریکنگ کا طریقہ',
    mode_indoor_title: 'طریقہ الف: اندرونی ذیلی میٹر',
    mode_indoor_desc: 'روزانہ اندرونی میٹر سے ریڈنگ لیں۔ بل آنے پر باہر والے لیسکو میٹر سے ملا لیں۔',
    mode_outdoor_title: 'طریقہ ب: براہ راست بیرونی میٹر',
    mode_outdoor_desc: 'براہ راست سرکاری بیرونی لیسکو میٹر سے ریڈنگ درج کریں۔ کسی اضافی ملاپ کی ضرورت نہیں۔',
    official_protected_limit: 'سرکاری محفوظ حد',
    statutory_limit_desc: 'سرکاری حد (200 یونٹس)',
    personal_target_input: 'ذاتی حفاظتی ہدف (یونٹس)',
    personal_target_desc: 'تجویز کردہ محفوظ ہدف: 190 یونٹ',
    preferred_time_input: 'روزانہ ریڈنگ کا پسندیدہ وقت',
    preferred_time_desc: 'تجویز کردہ: شام 6:00 بجے کے قریب',
    section_household: 'گھریلو معلومات',
    premise_name: 'گھر یا میٹر کا نام',
    city_division: 'شہر یا ڈویژن',
    lesco_ref_input: 'لیسکو ریفرنس نمبر',
    consumer_no_input: 'کنزیومر نمبر',
    btn_save_config: 'ترتیبات محفوظ کریں',
    section_scenarios: 'مختلف حالات آزما کر دیکھیں',
    scenarios_desc: 'مختلف حقیقت پسندانہ ٹیسٹ لوڈ کر کے دیکھیں کہ ایپ کس طرح خبردار کرتی ہے:',
    scenario_1_title: 'صورتحال 1: متوازن 180 یونٹس کی رفتار',
    scenario_1_desc: 'روزانہ تقریباً 5.8 یونٹس کا محفوظ استعمال جو 190 کے اندر ہے۔',
    scenario_2_title: 'صورتحال 2: شدید گرمی میں اضافہ کا خطرہ',
    scenario_2_desc: 'اے سی کے زیادہ استعمال سے 9.2 یونٹ یومیہ؛ متوقع 216 یونٹس۔',
    scenario_3_title: 'صورتحال 3: تاخیر سے آیا ہوا بل (4.2 فرق)',
    scenario_3_desc: 'بل دیر سے آنے پر بیرونی میٹر کے اضافی یونٹس کا صحیح حساب۔',
    scenario_4_title: 'صورتحال 4: 5 دن ریڈنگ نہ لینے کا وقفہ',
    scenario_4_desc: 'درمیانی دنوں کا استعمال خودکار طریقے سے تقسیم کر کے دکھایا گیا۔',
    section_portability: 'ڈیٹا بیک اپ اور برآمد',
    btn_export_backup: 'بیک اپ ڈاؤن لوڈ کریں (JSON)',
    btn_export_csv: 'ریڈنگز فائل (CSV)',
    btn_import_backup: 'بیک اپ فائل لائیں',
    btn_reset_data: 'ڈیٹا دوبارہ سیٹ کریں',
    reset_data_confirm: 'کیا آپ تمام ریڈنگز اور بلز کو ابتدائی نمونہ ڈیٹا پر ری سیٹ کرنا چاہتے ہیں؟',
    modal_add_title: 'میٹر ریڈنگ شامل کریں',
    modal_add_subtitle: 'اپنے میٹر پر نظر آنے والی موجودہ ریڈنگ درج کریں',
    modal_edit_title: 'میٹر ریڈنگ درست کریں',
    modal_edit_subtitle: 'تبدیلی کا ریکارڈ آڈٹ ٹریل میں محفوظ کیا جاتا ہے',
    cumulative_meter_val: 'میٹر ریڈنگ (کلو واٹ آور / kWh)',
    physical_reading_time: 'ریڈنگ کا وقت',
    added_to_app: 'ایپ میں اندراج کا وقت',
    notes_optional: 'نوٹس (اختیاری)',
    reason_for_correction: 'درستگی کی وجہ *',
    prev_reading_note: 'پچھلی ریڈنگ {val} kWh تھی ({time})',
    edit_audit_warning: 'یہ عمل ریڈنگ کو اپڈیٹ کر دے گا اور پرانی ویلیو {oldVal} اور نئی ویلیو {newVal} کا مستقل ریکارڈ محفوظ رکھے گا۔',
    btn_apply_correction: 'درستگی محفوظ کریں',
    btn_save_reading: 'ریڈنگ محفوظ کریں',
    btn_delete: 'حذف کریں',
    btn_cancel: 'منسوخ',
    delete_reading_confirm: 'کیا آپ واقعی یہ میٹر ریڈنگ حذف کرنا چاہتے ہیں؟ یہ عمل واپس نہیں ہو سکتا۔',
    match_meter_title: 'میٹر ملائیں',
    match_meter_subtitle: 'بل پر لکھی ریڈنگ اور بیرونی میٹر کا فرق درج کریں',
    lesco_bill_reading: 'لیسکو بل پر درج ریڈنگ:',
    official_date: 'سرکاری ریڈنگ کی تاریخ:',
    meter_reading_at_match: 'اس وقت بیرونی میٹر کی ریڈنگ (kWh)',
    resulting_gap: 'بل کے بعد کا اضافی استعمال:',
    confirm_unusual_gap: 'تصدیق کریں کہ یہ نمبر درست ہے',
    btn_confirm_match: 'ملاپ کی تصدیق کریں',
    val_reading_positive: 'براہ کرم درست مثبت میٹر ریڈنگ درج کریں۔',
    val_reading_future: 'ریڈنگ کا وقت مستقبل کا نہیں ہو سکتا۔',
    val_reading_duplicate: 'اس وقت اور ریڈنگ کا اندراج پہلے سے موجود ہے۔',
    val_reading_lower: 'یہ ریڈنگ پچھلی ریڈنگ سے کم ہے۔ براہ کرم نمبر چیک کریں۔',
    val_reading_higher: 'یہ ریڈنگ بعد کی تاریخ کی ریڈنگ سے زیادہ ہے۔ براہ کرم چیک کریں۔',
    val_outdoor_lower: 'بیرونی میٹر کی ریڈنگ بل پر لکھی ریڈنگ سے کم نہیں ہو سکتی۔',
    offline_notice: 'آپ آف لائن ہیں۔ تمام تر تبدیلیاں آپ کی ڈیوائس پر محفوظ ہیں۔',
    settings_saved_msg: 'ترتیبات کامیابی سے محفوظ ہو گئیں۔',
  },
};
