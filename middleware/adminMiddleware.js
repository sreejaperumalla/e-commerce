const jwt = require("jsonwebtoken");

const adminMiddleware = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {

    return res.status(401).json({
      message: "No token provided"
    });

  }

  const token = authHeader.split(" ")[1];

  try {
    console.log(token);
    const decoded = jwt.verify(
        
      token,
      process.env.JWT_SECRET || "mysecretkey"
    );
    console.log(decoded);

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      message: "Invalid token"
    });

  }

};

module.exports = adminMiddleware;