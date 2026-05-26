const passport = require("passport");
const pool = require("./db");
const GoogleStrategy =
  require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,

      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET,

      callbackURL:
        "https://e-commerce-production-68a9.up.railway.app/auth/google/callback",
    },

    async (accessToken, refreshToken, profile, done) => {

  try {

    const googleId = profile.id;

    const name = profile.displayName;

    const email = profile.emails[0].value;

    const userExists = await pool.query(
      "SELECT * FROM users WHERE google_id=$1",
      [googleId]
    );

    if (userExists.rows.length === 0) {

      await pool.query(
        "INSERT INTO users (google_id, name, email) VALUES ($1, $2, $3)",
        [googleId, name, email]
      );

      console.log("User inserted");

    } else {

      console.log("User already exists");

    }

    return done(null, profile);

  } catch (error) {

    console.log(error);

  }

}
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;