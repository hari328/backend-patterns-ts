Context of what I am trying to do

I am reading the book Terraform: Up and Running 3rd edition.

I am reading chapter 2 now, where there are multiple examples of terraform.

I want to try them out myself but I want to run them from github actions, I also want to connect my aws account with ODIC connection to github actions.

---

# Setup Guide: GitHub OIDC with AWS

## Overview

This guide sets up secure authentication between GitHub Actions and AWS using OpenID Connect (OIDC).
This eliminates the need for long-lived AWS credentials stored in GitHub Secrets.

## Prerequisites

- AWS Account with admin access
- GitHub repository: `hari328/backend-patterns-ts`
- Repository can be public or private

---

## Part 1: AWS Setup (Do This First)

### Step 1: Create OIDC Identity Provider

1. Go to **AWS Console** → **IAM** → **Identity providers**
2. Click **"Add provider"**
3. Select **"OpenID Connect"**
4. Enter:
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - Click **"Get thumbprint"** (auto-populates)
   - **Audience**: `sts.amazonaws.com`
5. Click **"Add provider"**

**What this does**: Tells AWS to trust tokens issued by GitHub's OIDC provider.

---

### Step 2: Create IAM Role for GitHub Actions

1. Go to **IAM** → **Roles** → **"Create role"**
2. Select **"Web identity"**
3. Choose:
   - **Identity provider**: `token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
4. Click **"Next"**
5. Attach policy: **AdministratorAccess** (for learning - restrict later!)
6. Click **"Next"**
7. **Role name**: `github-actions-role`
8. **BEFORE clicking "Create role"**, click **"Edit trust policy"**

---

### Step 3: Configure Trust Policy (CRITICAL!)

Replace the trust policy with one of these options:

#### Option A: Basic (Less Secure - Any branch/workflow)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:hari328/backend-patterns-ts:*"
        }
      }
    }
  ]
}
```

#### Option B: More Secure (Only main branch)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:hari328/backend-patterns-ts:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### Option C: Most Secure (Only protected environment - RECOMMENDED)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:hari328/backend-patterns-ts:environment:aws-terraform"
        }
      }
    }
  ]
}
```

**Replace `YOUR_AWS_ACCOUNT_ID`** with your 12-digit AWS account ID.

9. Click **"Create role"**
10. **Copy the Role ARN** - you'll need it for GitHub (looks like: `arn:aws:iam::123456789012:role/github-actions-role`)

---

## Part 2: GitHub Setup

### Step 1: Add AWS Role ARN as Secret

1. Go to: `https://github.com/hari328/backend-patterns-ts/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `AWS_ROLE_ARN`
4. Value: `arn:aws:iam::YOUR_ACCOUNT_ID:role/github-actions-role` (from AWS Step 3)
5. Click **"Add secret"**

---

### Step 2: Create Protected Environment (RECOMMENDED for Security)

1. Go to: `https://github.com/hari328/backend-patterns-ts/settings/environments`
2. Click **"New environment"**
3. Name: `aws-terraform` (must match workflow file!)
4. Configure **Environment protection rules**:
   - ✅ Check **"Required reviewers"**
   - ✅ Add yourself: `hari328`
   - ✅ (Optional) Check **"Deployment branches"** → Select "Selected branches" → Add `main`
5. Click **"Save protection rules"**

**What this does**:
- Workflow will PAUSE before accessing AWS
- You must manually approve each run
- Only you can approve (not just anyone with repo access)

---

### Step 3: Configure Fork PR Protection (If Repo is Public)

1. Go to: `https://github.com/hari328/backend-patterns-ts/settings/actions`
2. Scroll to **"Fork pull request workflows from outside collaborators"**
3. Select: **"Require approval for all outside collaborators"**
4. Click **"Save"**

**What this does**: Prevents random people from triggering workflows via PRs.

---

## Part 3: Understanding the Security Model

### What is a GitHub Environment?

A **GitHub Environment** is a deployment target with protection rules. Think of it like:
- `production` environment = requires approval before deploying
- `staging` environment = auto-deploys
- `aws-terraform` environment = requires approval before accessing AWS

### Why Add Environment to Trust Policy?

When GitHub Actions runs, it generates a JWT token with claims like:

```json
{
  "sub": "repo:hari328/backend-patterns-ts:environment:aws-terraform",
  "aud": "sts.amazonaws.com",
  "iss": "https://token.actions.githubusercontent.com",
  "ref": "refs/heads/main",
  "actor": "hari328"
}
```

The `sub` (subject) claim changes based on context:
- No environment: `repo:hari328/backend-patterns-ts:ref:refs/heads/main`
- With environment: `repo:hari328/backend-patterns-ts:environment:aws-terraform`

By restricting the trust policy to `environment:aws-terraform`, you ensure:
1. ✅ Workflow MUST use the protected environment
2. ✅ Protected environment requires YOUR approval
3. ✅ Even if someone modifies the workflow, they can't bypass approval
4. ✅ AWS rejects any token that doesn't come from that specific environment

### Security Comparison

| Method | Security Level | How It Works |
|--------|---------------|--------------|
| **No restrictions** | ❌ Low | Anyone with write access can run workflows and access AWS |
| **Branch restriction** | ⚠️ Medium | Only specific branches can access AWS, but anyone can push to that branch |
| **Environment restriction** | ✅ High | Requires manual approval from specific people before AWS access |

### The Most Secure Way (Recommended)

**Combine all three:**
1. ✅ **Manual trigger only** (`workflow_dispatch`) - No automatic runs
2. ✅ **Protected environment** - Requires your approval
3. ✅ **Trust policy with environment** - AWS only accepts tokens from protected environment

This creates **defense in depth**:
- GitHub level: Only you can approve workflow runs
- AWS level: Only tokens from approved environment are accepted
- Even if someone compromises your GitHub account, they still need to go through approval process

---

## Part 4: How to Use

### Running Terraform Manually

1. Go to **Actions** tab: `https://github.com/hari328/backend-patterns-ts/actions`
2. Click **"Terraform Manual Deploy"** workflow
3. Click **"Run workflow"** button
4. Fill in:
   - **Branch**: `main`
   - **Terraform action**: `plan`, `apply`, or `destroy`
   - **Working directory**: `terraform/github-oidc` (or your terraform path)
5. Click **"Run workflow"**
6. **Workflow pauses** → You get notification: "Review pending deployments"
7. Click notification → Review details → Click **"Approve and deploy"**
8. Workflow continues and accesses AWS

---

## Troubleshooting

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Cause**: Trust policy doesn't match the token claims.

**Fix**: Check that:
- Repository name in trust policy matches exactly: `hari328/backend-patterns-ts`
- If using environment restriction, environment name matches: `aws-terraform`
- AWS account ID is correct in the Federated ARN

### Error: "Error: The deployment was rejected or didn't receive an approval"

**Cause**: Environment protection is configured but you didn't approve.

**Fix**:
1. Go to Actions tab
2. Click on the workflow run
3. Click "Review deployments"
4. Select environment and click "Approve and deploy"

### Workflow doesn't pause for approval

**Cause**: Environment not configured or name mismatch.

**Fix**:
1. Check environment exists: Settings → Environments → `aws-terraform`
2. Check workflow uses correct name: `environment: aws-terraform`
3. Check environment has "Required reviewers" configured

---

## Next Steps

1. ✅ Complete AWS setup (Part 1)
2. ✅ Complete GitHub setup (Part 2)
3. ✅ Test the workflow with `terraform plan`
4. ✅ Once comfortable, use `terraform apply`
5. 🔒 Later: Restrict IAM role permissions from AdministratorAccess to specific services

---