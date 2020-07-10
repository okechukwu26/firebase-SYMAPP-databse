const isEmpty = (string) => {
  if (string.trim() === "") return true;
  else return false;
};
const reduceUserDetail = (data) => {
  let userDetail = {};
  if (!isEmpty(data.bio.trim())) userDetail.bio = data.bio;
  if (!isEmpty(data.website.trim())) {
    //https://website.com
    if (data.website.substring(0, 4) !== "http") {
      userDetail.website = `http://${data.website.trim()}`;
    } else userDetail.website = data.website;
  }
  if (!isEmpty(data.location.trim())) userDetail.location = data.location;
  return userDetail;
};

module.exports = {
  isEmpty,
  reduceUserDetail,
};
