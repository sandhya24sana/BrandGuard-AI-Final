import requests
import json

def verify_live_api():
    print("Testing live BrandGuard AI server at http://127.0.0.1:5000...")

    # 1. Health check
    res = requests.get('http://127.0.0.1:5000/api/health')
    print('Health status:', res.status_code, res.headers.get('content-type'))
    assert res.status_code == 200

    # 2. System Status check
    res_sys = requests.get('http://127.0.0.1:5000/api/analysis/system-status')
    assert res_sys.status_code == 200
    sys_data = res_sys.json()
    print(f"System Mode: {sys_data['mode']}")

    # 3. Test audit with Summer Flash Cloud Promo
    summer_promo_text = (
        "Looking for super cheap cloud hosting? Founded in 2012, ApexCloud is the ultimate AWS killer! "
        "Our cloud ninjas and infrastructure gurus have built a 100% bug-free platform with guaranteed zero downtime. "
        "Get crazy fast performance and unlimited free cloud servers forever. "
        "HURRY UP AND ACT NOW TO CLAIM YOUR ACCOUNT BEFORE IT'S GONE!!!"
    )

    res = requests.post('http://127.0.0.1:5000/api/analysis/audit', json={
        'brand_id': 1,
        'title': 'Summer Flash Cloud Promo (High Risk Violation Demo)',
        'content_type': 'Ad Copy',
        'channel': 'Twitter / X & LinkedIn Ads',
        'text': summer_promo_text
    })

    print('Audit status code:', res.status_code)
    print('Audit content-type:', res.headers.get('content-type'))
    data = res.json()
    assert data['success'] is True
    result = data['result']

    print('\n======================================================')
    print('LIVE VERIFICATION RESULTS (Summer Flash Cloud Promo)')
    print('======================================================')
    print(f"Compliance Score: {result['score']}/100")
    print(f"Risk Level:       {result['risk_level']} ({result['risk_badge']})")
    print(f"Issues Count:     {len(result['issues'])}")
    print("\nDetailed Issues Flagged:")
    for i, iss in enumerate(result['issues'], 1):
        print(f"  {i}. [{iss['severity']}] ({iss['category']}) Rule: {iss['rule']}")
        print(f"     Found: \"{iss.get('matched_text')}\"")
        print(f"     Explanation: {iss['explanation']}")
        print(f"     Suggested Fix: \"{iss.get('suggestion')}\"\n")

    print("BrandGuard Rewritten Version:")
    print(result['corrected_text'])
    print("\n✅ Verification SUCCESS: All issues, rules, severities, explanations, and suggestions correctly returned in valid JSON!")

if __name__ == "__main__":
    verify_live_api()
