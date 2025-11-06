# Zoho Sign API Debugging Guide

## Quick Debug Endpoints

### 1. Check Environment Variables
```bash
curl http://localhost:3000/api/debug/env
```

### 2. Test Zoho API Connectivity
```bash
curl http://localhost:3000/api/zoho/debug
```

This endpoint will:
- Check if all environment variables are set
- Test token refresh
- Test user info endpoint
- Test Zoho Sign API connectivity
- Show detailed error messages if anything fails

## Common Issues & Solutions

### Issue 1: "Missing env" Error
**Symptom:** API returns error about missing environment variables

**Solution:**
1. Make sure `.env.local` file exists in the `my-app` directory
2. Verify all required variables are set:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REFRESH_TOKEN`
3. Restart your Next.js dev server after updating `.env.local`

### Issue 2: "Failed to get access token"
**Symptom:** Token refresh fails

**Possible Causes:**
- Invalid refresh token
- Refresh token expired
- Wrong client ID/secret
- Data center mismatch

**Solution:**
1. Verify your refresh token is still valid
2. Check that client ID and secret match your Zoho API Console
3. Ensure `ZOHO_ACCOUNTS_BASE` matches your data center
4. Regenerate tokens if needed

### Issue 3: "Zoho auth/DC/org issue" or Error Code 9004 "No match found"
**Symptom:** `/api/v1/users/self` endpoint fails with error code 9004

**Possible Causes:**
- Account not found in Zoho Sign (most common)
- Account hasn't been activated in Zoho Sign
- Email mismatch between API Developer account and Zoho Sign account
- Token doesn't have Zoho Sign scopes
- Wrong data center
- License issue (error code 8026)

**Solution for Error 9004:**
1. **Sign up for Zoho Sign** (if you haven't already):
   - Go to https://sign.zoho.com
   - Sign up or log in with the same email used for your Zoho API Developer account
   - Activate your account by logging in at least once

2. **Verify email match:**
   - The email used for your Zoho API Developer account should match your Zoho Sign account email
   - Both API developer and e-sign profiles should be created with the same email

3. **Note:** The API might still work for creating signature requests even if `/users/self` fails with 9004. The code has been updated to continue in this case.

**Solution for Other Auth Issues:**
1. Check token scopes include: `ZohoSign.documents.ALL`, `ZohoSign.templates.ALL`
2. Verify `ZOHO_SIGN_BASE` matches your data center
3. Ensure your Zoho account has Zoho Sign enabled
4. Check if you need to upgrade your Zoho Sign license

### Issue 4: "Zoho create request failed"
**Symptom:** File upload/signature request creation fails

**Common Error Codes:**
- **8026**: Upgrade your Zoho Sign license
- **8001**: Invalid request format
- **8002**: Missing required fields
- **8003**: Invalid recipient email

**Solution:**
1. Check the error code and message in the response
2. Verify the payload structure matches Zoho Sign API requirements
3. Ensure all recipient emails are valid
4. Check file size limits (usually 10MB for free accounts)

## Debugging Steps

1. **Check Environment Setup:**
   ```bash
   curl http://localhost:3000/api/debug/env
   ```

2. **Test API Connectivity:**
   ```bash
   curl http://localhost:3000/api/zoho/debug
   ```

3. **Check Server Logs:**
   - Look at your Next.js dev server console
   - Check for detailed error messages
   - Look for Zoho API response codes

4. **Test with a Simple Request:**
   - Use the debug endpoint first
   - Then try uploading a small PDF
   - Check browser console for frontend errors

## Payload Structure

The correct payload structure for creating a signature request:

```json
{
  "requests": {
    "request_name": "Document Name",
    "description": "Description",
    "is_sequential": true,
    "actions": [
      {
        "action_type": "SIGN",
        "recipient_email": "user@example.com",
        "recipient_name": "User Name",
        "signing_order": 0,
        "verify_recipient": false,
        "verification_type": "EMAIL",
        "page_range": "1-3"
      }
    ],
    "expiration_days": 10,
    "email_reminders": true,
    "reminder_period": 2,
    "notes": "Notes for recipients"
  }
}
```

**Note:** `requests` should be an **object**, not an array.

## Testing Checklist

- [ ] Environment variables are set in `.env.local`
- [ ] Dev server restarted after env changes
- [ ] `/api/debug/env` shows all variables set
- [ ] `/api/zoho/debug` shows successful token refresh
- [ ] `/api/zoho/debug` shows successful Sign API connection
- [ ] PDF file is valid and under size limit
- [ ] Recipient emails are valid
- [ ] Request name and other fields are filled

## Getting Help

If you're still experiencing issues:

1. Check the Zoho Sign API error codes: https://www.zoho.com/sign/api/error-codes.html
2. Review the server logs for detailed error messages
3. Use the debug endpoint to isolate the issue
4. Verify your Zoho Sign account status and license

