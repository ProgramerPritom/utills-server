// GrowKins Admin Authentication Controller

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: {
          email: !email ? ['Email is required'] : [],
          password: !password ? ['Password is required'] : []
        }
      });
    }

    const isValidAdmin = (email.toLowerCase().includes('admin') || email.toLowerCase().includes('growkins')) && password.length >= 6;

    if (!isValidAdmin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password must be at least 6 characters.'
      });
    }

    const user = {
      id: 'usr_admin',
      name: 'GrowKins Admin',
      email: email.toLowerCase(),
      role: 'admin',
      avatar: 'https://lh3.googleusercontent.com/d/admin-avatar'
    };

    const token = 'growkins_jwt_' + Buffer.from(email + ':' + Date.now()).toString('base64');

    res.json({
      success: true,
      data: {
        user,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.json({
    success: true,
    data: {
      id: 'usr_admin',
      name: 'GrowKins Admin',
      email: 'admin@growkins.com',
      role: 'admin'
    }
  });
}

async function logout(req, res) {
  res.json({ success: true, message: 'Logged out successfully' });
}

async function refresh(req, res) {
  res.json({
    success: true,
    data: {
      token: 'growkins_jwt_' + Date.now(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  });
}

module.exports = {
  login,
  getMe,
  logout,
  refresh
};
